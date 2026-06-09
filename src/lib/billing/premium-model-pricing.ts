import { isAutomaticModelId } from "@/lib/ai/resolve-automatic-model";

/** User-selected premium models cost more BC — provider spend is higher. */
const PREMIUM_MODEL_MULTIPLIERS: Record<string, number> = {
  "claude-sonnet-4-6": 1.35,
  "claude-sonnet-4.5": 1.3,
  "claude-opus-4.6": 1.6,
  "claude-opus-4.7": 1.75,
  "gpt-5.4": 1.25,
  "gpt-5.4-pro": 1.4,
};

export function premiumModelCreditMultiplier(modelId: string | null | undefined): number {
  if (!modelId || isAutomaticModelId(modelId)) return 1;
  const key = modelId.trim().toLowerCase();
  return PREMIUM_MODEL_MULTIPLIERS[key] ?? 1;
}

export function applyPremiumModelCredits(credits: number, modelId: string | null | undefined): number {
  const mult = premiumModelCreditMultiplier(modelId);
  if (mult <= 1) return credits;
  return Math.ceil(credits * mult * 10) / 10;
}
