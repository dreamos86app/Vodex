import { INTEGRATION_PROVIDERS } from "@/lib/generated-apps/integration-registry";

export type IntegrationRequirement = {
  provider: string;
  label: string;
  reason: string;
  dashboardMessage: string;
};

const PROMPT_RULES: Array<{ pattern: RegExp; provider: string; reason: string }> = [
  { pattern: /\b(email|resend|newsletter|transactional)\b/i, provider: "resend", reason: "Email sending" },
  { pattern: /\b(stripe|checkout|payment|subscribe|billing)\b/i, provider: "stripe", reason: "Payments" },
  { pattern: /\b(paddle)\b/i, provider: "paddle", reason: "Paddle billing" },
  { pattern: /\b(paypal)\b/i, provider: "paypal", reason: "PayPal checkout" },
  { pattern: /\b(supabase|postgres|database|auth)\b/i, provider: "supabase", reason: "Database / auth" },
  { pattern: /\b(github|git push|repository)\b/i, provider: "github", reason: "GitHub sync" },
  { pattern: /\b(openai|gpt-?4|chatgpt)\b/i, provider: "openai", reason: "OpenAI models" },
  { pattern: /\b(anthropic|claude)\b/i, provider: "anthropic", reason: "Anthropic models" },
  { pattern: /\b(gemini|google ai)\b/i, provider: "gemini", reason: "Gemini models" },
  { pattern: /\b(discord webhook|discord notify)\b/i, provider: "discord", reason: "Discord notifications" },
];

export function detectRequiredIntegrations(prompt: string, blueprintText?: string): IntegrationRequirement[] {
  const text = `${prompt}\n${blueprintText ?? ""}`;
  const seen = new Set<string>();
  const out: IntegrationRequirement[] = [];

  for (const rule of PROMPT_RULES) {
    if (!rule.pattern.test(text) || seen.has(rule.provider)) continue;
    seen.add(rule.provider);
    const def = INTEGRATION_PROVIDERS.find((p) => p.id === rule.provider);
    out.push({
      provider: rule.provider,
      label: def?.label ?? rule.provider,
      reason: rule.reason,
      dashboardMessage: `${def?.label ?? rule.provider} missing — related features stay disabled until configured.`,
    });
  }

  return out;
}

export function integrationPromptBlock(requirements: IntegrationRequirement[]): string {
  if (requirements.length === 0) return "";
  return [
    "INTEGRATION RULES (mandatory):",
    ...requirements.map(
      (r) =>
        `- ${r.label}: generate code that checks process.env / server config and shows honest "not configured" UI if secrets missing. Never fake success.`,
    ),
    "- Runtime AI in the generated app uses Vodex Action Credits unless the owner configured their own OpenAI/Anthropic/Gemini API key.",
  ].join("\n");
}
