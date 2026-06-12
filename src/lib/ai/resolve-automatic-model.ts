import { isDreamosOwnerEmail } from "@/lib/admin-owner";
import { isProviderSelectable } from "@/lib/ai/provider-availability";
import { hasAnyLlmProviderKey } from "@/lib/llm/env-keys";
import { pickUiImplementationModelId } from "@/lib/ai/ui-implementation-model";

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
 * Automatic implementation — UI-capable models only (Gemini > OpenAI > Claude).
 */
export function pickAutomaticImplementationModelId(
  complexity: number,
  ownerEmail?: string | null,
): string {
  return pickUiImplementationModelId(complexity, ownerEmail);
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
