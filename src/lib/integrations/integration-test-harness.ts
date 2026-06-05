import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { unsealSecret } from "@/lib/secrets/seal";
import { getIntegrationProvider } from "@/lib/generated-apps/integration-registry";
import { testGitHubConnection, parseGitHubRepo } from "@/lib/integrations/server/github-api";
import { testSupabaseAnon, testSupabaseServiceRole } from "@/lib/integrations/server/supabase-api";
import { upsertAppIntegrationConnection } from "@/lib/integrations/app-runtime-connections";
import type {
  IntegrationConnectionMode,
  IntegrationTestStatus,
} from "@/lib/integrations/integration-test-harness-types";

export type { IntegrationConnectionMode, IntegrationTestStatus } from "@/lib/integrations/integration-test-harness-types";

export type IntegrationTestResult = {
  ok: boolean;
  mode: IntegrationConnectionMode;
  testStatus: IntegrationTestStatus;
  label: "mock" | "sandbox" | "live";
  message: string;
  connectionHealth: string;
  webhookStatus: string;
};

const MOCK_PROVIDERS = new Set([
  "openai",
  "anthropic",
  "gemini",
  "firebase",
  "resend",
  "stripe",
  "paypal",
  "paddle",
  "lemon_squeezy",
  "revenuecat",
]);

function detectMode(metadata: Record<string, unknown>, hasSecrets: boolean): IntegrationConnectionMode {
  if (metadata.force_mock === true) return "connected_mock";
  if (!hasSecrets) return "disconnected";
  const m = metadata.mode;
  if (m === "sandbox" || m === "test") return "connected_sandbox";
  if (m === "mock") return "connected_mock";
  if (m === "live" || m === "production") return "connected_live";
  return "connected_sandbox";
}

function shapeCheck(provider: string, secrets: Record<string, string>): string | null {
  if (provider === "stripe") {
    const sk = secrets.STRIPE_SECRET_KEY ?? secrets.secret_key ?? "";
    const pk = secrets.STRIPE_PUBLISHABLE_KEY ?? secrets.publishable_key ?? "";
    if (sk && !/^sk_(test|live)_/.test(sk)) return "Stripe secret key must start with sk_test_ or sk_live_";
    if (pk && !/^pk_(test|live)_/.test(pk)) return "Stripe publishable key must start with pk_test_ or pk_live_";
    const wh = secrets.STRIPE_WEBHOOK_SECRET ?? secrets.webhook_secret ?? "";
    if (wh && !/^whsec_/.test(wh)) return "Stripe webhook secret must start with whsec_";
  }
  if (provider === "paypal") {
    const id = secrets.PAYPAL_CLIENT_ID ?? secrets.client_id ?? "";
    if (id && id.length < 10) return "PayPal client ID looks too short";
  }
  if (provider === "paddle") {
    const key = secrets.PADDLE_API_KEY ?? secrets.api_key ?? "";
    if (key && key.length < 8) return "Paddle API key looks invalid";
  }
  if (provider === "lemonsqueezy" || provider === "lemon_squeezy") {
    const key = secrets.LEMON_SQUEEZY_API_KEY ?? secrets.api_key ?? "";
    if (key && !key.startsWith("eyJ")) return "Lemon Squeezy API key should be a JWT-shaped string";
  }
  return null;
}

async function loadProjectSecrets(projectId: string): Promise<Record<string, string>> {
  const admin = createServiceRoleClient();
  if (!admin) return {};
  const { data: rows } = await admin
    .from("project_secrets")
    .select("key_name, ciphertext, encrypted_value")
    .eq("project_id", projectId);
  const out: Record<string, string> = {};
  for (const row of rows ?? []) {
    const sealed = (row.ciphertext ?? row.encrypted_value) as string | null;
    if (!sealed) continue;
    try {
      out[row.key_name as string] = unsealSecret(sealed);
    } catch {
      /* skip */
    }
  }
  return out;
}

async function loadIntegrationMeta(
  projectId: string,
  provider: string,
): Promise<Record<string, unknown>> {
  const admin = createServiceRoleClient();
  if (!admin) return {};
  const { data } = await admin
    .from("project_integrations")
    .select("metadata, status")
    .eq("project_id", projectId)
    .eq("provider", provider)
    .maybeSingle();
  return (data?.metadata ?? {}) as Record<string, unknown>;
}

function mockResult(provider: string): IntegrationTestResult {
  return {
    ok: true,
    mode: "connected_mock",
    testStatus: "mock_ok",
    label: "mock",
    message: `${provider} mock test passed — no live API call (mock mode).`,
    connectionHealth: "healthy",
    webhookStatus: "not_applicable",
  };
}

export async function runIntegrationProviderTest(input: {
  projectId: string;
  ownerId: string;
  provider: string;
  forceMock?: boolean;
}): Promise<IntegrationTestResult> {
  const provider = input.provider === "lemonsqueezy" ? "lemon_squeezy" : input.provider;
  const def = getIntegrationProvider(provider === "lemon_squeezy" ? "lemonsqueezy" : provider);
  const secrets = await loadProjectSecrets(input.projectId);
  const meta = await loadIntegrationMeta(input.projectId, provider);
  const hasSecrets = Object.keys(secrets).length > 0;
  const mode = input.forceMock || meta.force_mock === true
    ? "connected_mock"
    : detectMode(meta, hasSecrets);

  if (input.forceMock || mode === "connected_mock") {
    const result = mockResult(provider);
    await upsertAppIntegrationConnection({
      projectId: input.projectId,
      ownerId: input.ownerId,
      provider,
      status: "connected",
      mode: "connected_mock",
      lastTestStatus: result.testStatus,
      lastError: null,
      connectionHealth: result.connectionHealth,
      webhookStatus: result.webhookStatus,
      metadata: { ...meta, test_label: "mock" },
    });
    return result;
  }

  if (!def) {
    const result: IntegrationTestResult = {
      ok: false,
      mode: "error",
      testStatus: "error",
      label: "live",
      message: `Unknown provider: ${provider}`,
      connectionHealth: "error",
      webhookStatus: "unknown",
    };
    await upsertAppIntegrationConnection({
      projectId: input.projectId,
      ownerId: input.ownerId,
      provider,
      status: "failed",
      mode: "error",
      lastTestStatus: result.testStatus,
      lastError: result.message,
      connectionHealth: "error",
      metadata: meta,
    });
    return result;
  }

  const required = def.fields.filter((f) => f.required).map((f) => f.key);
  const missing = required.filter((k) => !secrets[k]?.trim());
  if (missing.length) {
    const result: IntegrationTestResult = {
      ok: false,
      mode: "disconnected",
      testStatus: "missing_required_fields",
      label: mode === "connected_sandbox" ? "sandbox" : "live",
      message: `Missing required fields: ${missing.join(", ")}`,
      connectionHealth: "incomplete",
      webhookStatus: "unknown",
    };
    await upsertAppIntegrationConnection({
      projectId: input.projectId,
      ownerId: input.ownerId,
      provider,
      status: "failed",
      mode: "disconnected",
      lastTestStatus: result.testStatus,
      lastError: result.message,
      connectionHealth: "incomplete",
      metadata: meta,
    });
    return result;
  }

  const shapeErr = shapeCheck(provider, secrets);
  if (shapeErr) {
    const result: IntegrationTestResult = {
      ok: false,
      mode: "error",
      testStatus: "invalid_credentials",
      label: mode === "connected_sandbox" ? "sandbox" : "live",
      message: shapeErr,
      connectionHealth: "error",
      webhookStatus: "unknown",
    };
    await upsertAppIntegrationConnection({
      projectId: input.projectId,
      ownerId: input.ownerId,
      provider,
      status: "failed",
      mode: "error",
      lastTestStatus: result.testStatus,
      lastError: result.message,
      connectionHealth: "error",
      metadata: meta,
    });
    return result;
  }

  if (provider === "github") {
    const token = secrets.GITHUB_TOKEN ?? "";
    const repoStr = typeof meta.repo === "string" ? meta.repo : null;
    const test = await testGitHubConnection(token, repoStr ? parseGitHubRepo(repoStr) : null);
    const label = mode === "connected_live" ? "live" : "sandbox";
    const result: IntegrationTestResult = test.ok
      ? {
          ok: true,
          mode: mode === "disconnected" ? "connected_live" : mode,
          testStatus: "live_ok",
          label,
          message: `GitHub live test OK${test.repoFullName ? ` — ${test.repoFullName}` : ""}`,
          connectionHealth: "healthy",
          webhookStatus: "not_applicable",
        }
      : {
          ok: false,
          mode: "error",
          testStatus: "invalid_credentials",
          label,
          message: test.error ?? "GitHub test failed",
          connectionHealth: "error",
          webhookStatus: "unknown",
        };
    await upsertAppIntegrationConnection({
      projectId: input.projectId,
      ownerId: input.ownerId,
      provider,
      status: result.ok ? "connected" : "failed",
      mode: result.mode,
      lastTestStatus: result.testStatus,
      lastError: result.ok ? null : result.message,
      connectionHealth: result.connectionHealth,
      accountLabel: test.ok ? (test.repoFullName ?? `@${test.login}`) : null,
      metadata: meta,
    });
    return result;
  }

  if (provider === "supabase") {
    const url = secrets.SUPABASE_URL ?? "";
    const anon = secrets.SUPABASE_ANON_KEY ?? "";
    const service = secrets.SUPABASE_SERVICE_ROLE_KEY;
    const anonTest = await testSupabaseAnon(url, anon);
    let svcOk = true;
    if (service) {
      const svcTest = await testSupabaseServiceRole(url, service);
      svcOk = svcTest.ok;
    }
    const test = anonTest.ok && svcOk ? anonTest : anonTest.ok ? { ok: false, error: "Service role key failed" } : anonTest;
    const result: IntegrationTestResult = test.ok
      ? {
          ok: true,
          mode: "connected_live",
          testStatus: "live_ok",
          label: "live",
          message: "Supabase connection OK",
          connectionHealth: "healthy",
          webhookStatus: "not_applicable",
        }
      : {
          ok: false,
          mode: "error",
          testStatus: "invalid_credentials",
          label: "live",
          message: test.error ?? "Supabase test failed",
          connectionHealth: "error",
          webhookStatus: "unknown",
        };
    await upsertAppIntegrationConnection({
      projectId: input.projectId,
      ownerId: input.ownerId,
      provider,
      status: result.ok ? "connected" : "failed",
      mode: result.mode,
      lastTestStatus: result.testStatus,
      lastError: result.ok ? null : result.message,
      connectionHealth: result.connectionHealth,
      metadata: meta,
    });
    return result;
  }

  if (MOCK_PROVIDERS.has(provider) && !hasSecrets) {
    return mockResult(provider);
  }

  const label = mode === "connected_live" ? "live" : "sandbox";
  const webhookSecret =
    secrets.STRIPE_WEBHOOK_SECRET ??
    secrets.PADDLE_WEBHOOK_SECRET ??
    secrets.webhook_secret ??
    "";
  const webhookStatus = webhookSecret ? "configured" : "webhook_unverified";

  const result: IntegrationTestResult = {
    ok: true,
    mode: mode === "disconnected" ? "connected_sandbox" : mode,
    testStatus: mode === "connected_live" ? "live_ok" : "sandbox_ok",
    label,
    message: `${def.label} credentials validated (${label} shape check).${
      webhookSecret ? "" : " Webhook secret not configured."
    }`,
    connectionHealth: "healthy",
    webhookStatus,
  };

  if (!webhookSecret && ["stripe", "paddle", "lemon_squeezy", "paypal"].includes(provider)) {
    result.testStatus = "webhook_unverified";
    result.webhookStatus = "unverified";
  }

  await upsertAppIntegrationConnection({
    projectId: input.projectId,
    ownerId: input.ownerId,
    provider,
    status: "connected",
    mode: result.mode,
    lastTestStatus: result.testStatus,
    lastError: null,
    connectionHealth: result.connectionHealth,
    webhookStatus: result.webhookStatus,
    metadata: { ...meta, test_label: label },
  });

  return result;
}
