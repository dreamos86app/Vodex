import { isProviderSelectable } from "@/lib/ai/provider-availability";

/** Models too weak for full UI page generation — discuss/plan only. */
export const UI_BUILD_EXCLUDED_MODEL_IDS = new Set([
  "gpt-4o-mini",
  "gpt-5.4-mini",
  "gpt-5-4-mini",
  "gemini-flash",
  "gemini-2-0-flash",
  "claude-haiku-4-5",
  "claude-haiku-4.5",
  "deepseek-chat",
]);

export function isUiBuildCapableModelId(modelId: string | null | undefined): boolean {
  if (!modelId) return true;
  const id = modelId.trim().toLowerCase();
  if (id === "automatic" || id === "auto" || id === "default") return true;
  return !UI_BUILD_EXCLUDED_MODEL_IDS.has(id);
}

/**
 * Default UI builder — Gemini first (quality + value), then OpenAI, then Claude.
 * Never returns mini/flash/haiku models.
 */
export function pickUiImplementationModelId(
  complexity: number,
  ownerEmail?: string | null,
): string {
  void ownerEmail;
  void complexity;
  const googleOk = isProviderSelectable("google");
  const openAiOk = isProviderSelectable("openai");
  const anthropicOk = isProviderSelectable("anthropic");

  if (googleOk) return "gemini-3-1-pro";
  if (openAiOk) return "gpt-5.4";
  if (anthropicOk) return "claude-sonnet-4-6";
  return "gpt-5.4";
}

/** Coerce user/automatic selection to a UI-capable catalog id for implementation ops. */
export function ensureUiImplementationModelId(
  requestedModelId: string | null | undefined,
  complexity?: number,
  ownerEmail?: string | null,
): string {
  if (!requestedModelId || requestedModelId === "automatic") {
    return pickUiImplementationModelId(complexity ?? 7, ownerEmail);
  }
  if (isUiBuildCapableModelId(requestedModelId)) {
    return requestedModelId.trim();
  }
  return pickUiImplementationModelId(complexity ?? 7, ownerEmail);
}
