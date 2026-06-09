import { isDreamosOwnerEmail } from "@/lib/admin-owner";
import { isProviderSelectable } from "@/lib/ai/provider-availability";
import { hasAnyLlmProviderKey, googleGenerativeApiKey } from "@/lib/llm/env-keys";

const AUTOMATIC_ALIASES = new Set(["automatic", "auto", "default"]);

export function isAutomaticModelId(modelId: string | undefined | null): boolean {
  if (!modelId) return true;
  return AUTOMATIC_ALIASES.has(modelId.trim().toLowerCase());
}

/** Cheapest model for understanding, chat, and lightweight JSON tasks. */
export function pickCheapestDiscussModelId(): string {
  if (isProviderSelectable("openai")) return "gpt-5.4-mini";
  if (isProviderSelectable("google")) return "gemini-flash";
  if (isProviderSelectable("anthropic")) return "claude-haiku-4.5";
  return "gpt-5.4-mini";
}

/**
 * Automatic implementation — best tier that fits complexity (Opus 4.7 → 4.6 → Sonnet 4.6).
 * Cheap models only for trivial scope (complexity ≤ 3).
 */
export function pickAutomaticImplementationModelId(
  complexity: number,
  ownerEmail?: string | null,
): string {
  const c = Math.min(10, Math.max(1, complexity));
  const anthropicOk = isProviderSelectable("anthropic");
  const openAiOk = isProviderSelectable("openai");

  if (c <= 6) {
    if (openAiOk) return "gpt-5.4-mini";
    if (isProviderSelectable("google")) return "gemini-flash";
    if (anthropicOk) return "claude-haiku-4.5";
    return pickCheapestDiscussModelId();
  }

  if (!anthropicOk) {
    if (openAiOk) return c >= 8 ? "gpt-5.4" : "gpt-5.4-mini";
    return pickCheapestDiscussModelId();
  }

  if (c >= 9) {
    if (isDreamosOwnerEmail(ownerEmail)) return "claude-opus-4.7";
    return "claude-opus-4.6";
  }
  if (c >= 8) return "claude-opus-4.6";
  if (c >= 7) return "claude-sonnet-4-6";
  return "gpt-5.4-mini";
}

/** Legacy export — maps modes to tiered automatic picks (no longer forces Sonnet everywhere). */
export function resolveAutomaticModelId(
  mode: "discuss" | "edit" | "build",
  complexity = 5,
  ownerEmail?: string | null,
): string {
  if (mode === "discuss") return pickCheapestDiscussModelId();
  if (mode === "edit") {
    return complexity >= 7
      ? pickAutomaticImplementationModelId(complexity, ownerEmail)
      : pickCheapestDiscussModelId();
  }
  return pickAutomaticImplementationModelId(complexity, ownerEmail);
}

export function assertLlmConfigured(): void {
  if (!hasAnyLlmProviderKey()) {
    throw new Error("No LLM API key configured");
  }
}
