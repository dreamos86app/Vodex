import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";

export type IntegrationConnectionMode =
  | "disconnected"
  | "connected_mock"
  | "connected_sandbox"
  | "connected_live"
  | "error";

export type IntegrationTestStatus =
  | "ok"
  | "mock_ok"
  | "sandbox_ok"
  | "live_ok"
  | "missing_required_fields"
  | "invalid_credentials"
  | "webhook_unverified"
  | "error";

const P47_PROVIDERS = new Set([
  "github",
  "supabase",
  "stripe",
  "paypal",
  "paddle",
  "lemon_squeezy",
  "revenuecat",
  "resend",
  "openai",
  "anthropic",
  "gemini",
  "firebase",
]);

export function isP47IntegrationProvider(provider: string): boolean {
  return P47_PROVIDERS.has(provider);
}

export async function upsertAppIntegrationConnection(opts: {
  projectId: string;
  ownerId: string;
  provider: string;
  status: "pending" | "connected" | "failed" | "disconnected";
  mode: IntegrationConnectionMode;
  accountLabel?: string | null;
  lastTestStatus?: IntegrationTestStatus | null;
  lastError?: string | null;
  connectionHealth?: string;
  webhookStatus?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!isP47IntegrationProvider(opts.provider)) return;
  const admin = createServiceRoleClient();
  if (!admin) return;

  const now = new Date().toISOString();
  await admin.from("app_integration_connections" as never).upsert(
    {
      project_id: opts.projectId,
      owner_id: opts.ownerId,
      provider: opts.provider,
      status: opts.status,
      mode: opts.mode,
      account_label: opts.accountLabel ?? null,
      last_test_status: opts.lastTestStatus ?? null,
      last_test_at: opts.lastTestStatus ? now : null,
      last_error: opts.lastError ?? null,
      connection_health: opts.connectionHealth ?? "unknown",
      webhook_status: opts.webhookStatus ?? "unknown",
      metadata: opts.metadata ?? {},
      connected_at: opts.status === "connected" ? now : null,
      updated_at: now,
    } as never,
    { onConflict: "project_id,provider" },
  );
}
