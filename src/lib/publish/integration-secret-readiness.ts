import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { detectRequiredIntegrations } from "@/lib/generated-apps/integration-requirements";
import { INTEGRATION_PROVIDERS } from "@/lib/generated-apps/integration-registry";
import type { LegacyPlatformInfo } from "@/lib/import/legacy-platform-detector";

export type PublishSetupGap = {
  kind: "integration" | "secret";
  provider: string;
  label: string;
  message: string;
  href: "integrations" | "secrets";
  severity: "blocker" | "recommended" | "optional";
};

type Writer = SupabaseClient<Database>;

const SHIM_SATISFIED_KEYS = new Set([
  "VITE_BASE44_APP_BASE_URL",
  "BASE44_APP_BASE_URL",
  "BASE44_API_URL",
  "BASE44_PROJECT_ID",
  "BASE44_APP_ID",
  "VITE_BASE44_APP_ID",
  "VITE_BASE44_PROJECT_ID",
  "DEV",
  "DEBUG_BLOCKS",
  "VITE_DEV",
  "NODE_ENV",
]);

const NEVER_REQUIRED_PATTERNS = [
  /^VITE_BASE44_/i,
  /^BASE44_/i,
  /^DEV$/i,
  /^DEBUG_/i,
  /^VITE_DEV$/i,
  /FIREBASE_/i,
  /VITE_FIREBASE_/i,
];

const FILE_ENV_PATTERNS: Array<{ pattern: RegExp; provider: string; runtimeOnly?: boolean }> = [
  { pattern: /NEXT_PUBLIC_SUPABASE_URL|VITE_SUPABASE_URL/i, provider: "supabase" },
  { pattern: /STRIPE_SECRET|STRIPE_WEBHOOK|VITE_STRIPE/i, provider: "stripe", runtimeOnly: true },
  { pattern: /RESEND_API_KEY/i, provider: "resend", runtimeOnly: true },
  { pattern: /OPENAI_API_KEY|VITE_OPENAI/i, provider: "openai", runtimeOnly: true },
  { pattern: /ANTHROPIC_API_KEY/i, provider: "anthropic", runtimeOnly: true },
  { pattern: /GEMINI_API_KEY|GOOGLE_GENERATIVE_AI/i, provider: "gemini", runtimeOnly: true },
  { pattern: /PAYPAL_|VITE_PAYPAL/i, provider: "paypal", runtimeOnly: true },
  { pattern: /PADDLE_/i, provider: "paddle", runtimeOnly: true },
  { pattern: /REVENUECAT/i, provider: "revenuecat", runtimeOnly: true },
];

function envKeyReferencedInSource(key: string, combined: string): boolean {
  if (SHIM_SATISFIED_KEYS.has(key)) return false;
  if (NEVER_REQUIRED_PATTERNS.some((p) => p.test(key))) return false;
  const patterns = [
    new RegExp(`import\\.meta\\.env\\.${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"),
    new RegExp(`process\\.env\\.${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"),
    new RegExp(`\\$\\{${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\}`, "i"),
    new RegExp(`['"]${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}['"]`, "i"),
  ];
  return patterns.some((p) => p.test(combined));
}

function providerReferencedInSource(providerId: string, combined: string): boolean {
  return FILE_ENV_PATTERNS.some(
    (r) => r.provider === providerId && r.pattern.test(combined),
  );
}

export async function collectPublishSetupGaps(
  admin: Writer,
  projectId: string,
  input: {
    prompt?: string;
    files: Array<{ path: string; content: string }>;
    legacy?: LegacyPlatformInfo | null;
  },
): Promise<PublishSetupGap[]> {
  const combined = input.files.map((f) => f.content).join("\n");
  const fromPrompt = detectRequiredIntegrations(input.prompt ?? "", combined);
  const providers = new Set<string>();

  for (const r of fromPrompt) {
    if (providerReferencedInSource(r.provider, combined)) {
      providers.add(r.provider);
    }
  }

  if (input.legacy?.platform === "base44" && !input.legacy.usesBase44Sdk) {
    providers.delete("discord");
  }

  for (const rule of FILE_ENV_PATTERNS) {
    if (rule.pattern.test(combined)) providers.add(rule.provider);
  }

  const [{ data: integrations }, { data: secrets }] = await Promise.all([
    admin
      .from("project_integrations")
      .select("provider, status")
      .eq("project_id", projectId),
    admin.from("project_secrets").select("key_name").eq("project_id", projectId),
  ]);

  const connected = new Set(
    (integrations ?? [])
      .filter((r) => r.status === "connected")
      .map((r) => r.provider as string),
  );
  const savedKeys = new Set((secrets ?? []).map((r) => r.key_name as string));

  const gaps: PublishSetupGap[] = [];

  for (const providerId of providers) {
    const def = INTEGRATION_PROVIDERS.find((p) => p.id === providerId);
    const label = def?.label ?? providerId;
    const referenced = providerReferencedInSource(providerId, combined);

    if (providerId === "github" || providerId === "supabase") {
      if (!connected.has(providerId) && referenced) {
        gaps.push({
          kind: "integration",
          provider: providerId,
          label,
          message: `Connect ${label} before publishing`,
          href: "integrations",
          severity: providerId === "supabase" && input.legacy?.usesBase44Sdk ? "blocker" : "recommended",
        });
      }
      continue;
    }

    const missingKeys = (def?.secretKeys ?? []).filter(
      (k) => !savedKeys.has(k) && envKeyReferencedInSource(k, combined),
    );
    if (missingKeys.length > 0) {
      gaps.push({
        kind: "secret",
        provider: providerId,
        label,
        message: `Add ${missingKeys.join(", ")} in Secrets`,
        href: "secrets",
        severity: "blocker",
      });
    } else if ((def?.secretKeys ?? []).some((k) => !savedKeys.has(k) && !envKeyReferencedInSource(k, combined))) {
      gaps.push({
        kind: "secret",
        provider: providerId,
        label,
        message: `${label} keys optional — only needed if your app calls ${label} at runtime`,
        href: "secrets",
        severity: "optional",
      });
    }
  }

  return gaps;
}

export function gapsToBlockers(gaps: PublishSetupGap[]): string[] {
  return gaps.filter((g) => g.severity === "blocker").map((g) => g.message);
}

export function gapsRecommended(gaps: PublishSetupGap[]): PublishSetupGap[] {
  return gaps.filter((g) => g.severity === "recommended");
}

export function gapsOptional(gaps: PublishSetupGap[]): PublishSetupGap[] {
  return gaps.filter((g) => g.severity === "optional");
}
