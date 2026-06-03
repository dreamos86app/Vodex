import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { detectRequiredIntegrations } from "@/lib/generated-apps/integration-requirements";
import { INTEGRATION_PROVIDERS } from "@/lib/generated-apps/integration-registry";

export type PublishSetupGap = {
  kind: "integration" | "secret";
  provider: string;
  label: string;
  message: string;
  href: "integrations" | "secrets";
};

type Writer = SupabaseClient<Database>;

const FILE_ENV_PATTERNS: Array<{ pattern: RegExp; provider: string }> = [
  { pattern: /NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE/i, provider: "supabase" },
  { pattern: /STRIPE_SECRET|STRIPE_WEBHOOK/i, provider: "stripe" },
  { pattern: /RESEND_API_KEY/i, provider: "resend" },
  { pattern: /OPENAI_API_KEY/i, provider: "openai" },
  { pattern: /ANTHROPIC_API_KEY/i, provider: "anthropic" },
  { pattern: /GEMINI_API_KEY|GOOGLE_GENERATIVE_AI/i, provider: "gemini" },
];

export async function collectPublishSetupGaps(
  admin: Writer,
  projectId: string,
  input: {
    prompt?: string;
    files: Array<{ path: string; content: string }>;
  },
): Promise<PublishSetupGap[]> {
  const combined = input.files.map((f) => f.content).join("\n");
  const fromPrompt = detectRequiredIntegrations(input.prompt ?? "", combined);
  const providers = new Set<string>(fromPrompt.map((r) => r.provider));

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

    if (providerId === "github" || providerId === "supabase") {
      if (!connected.has(providerId)) {
        gaps.push({
          kind: "integration",
          provider: providerId,
          label,
          message: `Connect ${label} before publishing`,
          href: "integrations",
        });
      }
      continue;
    }

    const missingKeys = (def?.secretKeys ?? []).filter((k) => !savedKeys.has(k));
    if (missingKeys.length > 0) {
      gaps.push({
        kind: "secret",
        provider: providerId,
        label,
        message: `Add ${missingKeys.join(", ")} in Secrets`,
        href: "secrets",
      });
    }
  }

  return gaps;
}

export function gapsToBlockers(gaps: PublishSetupGap[]): string[] {
  return gaps.map((g) => g.message);
}
