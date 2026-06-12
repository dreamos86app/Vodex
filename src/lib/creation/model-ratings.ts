/** Decimal model scores — 5.0 is best capability; cost 5.0 = cheapest, 1.0 = most expensive. */
export type ModelRatingScore = number;

export const COMING_SOON_MODEL_IDS = new Set([
  "grok-4",
  "llama-4-maverick",
  "deepseek-reasoner",
  "command-r-plus",
  "mistral-large",
]);

/** Hidden from build model picker — too weak for full UI generation. */
export const BUILD_UI_EXCLUDED_MODEL_IDS = new Set([
  "gpt-4o-mini",
  "gpt-5.4-mini",
  "gemini-flash",
  "gemini-2-0-flash",
  "claude-haiku-4-5",
  "deepseek-chat",
]);

/** Available models first, coming-soon models at the bottom. */
export function sortModelsForPicker<T extends { id: string; comingSoon?: boolean }>(
  models: T[],
  isComingSoon: (model: T) => boolean = (m) =>
    Boolean(m.comingSoon) || COMING_SOON_MODEL_IDS.has(m.id),
): T[] {
  const ready: T[] = [];
  const soon: T[] = [];
  for (const model of models) {
    if (isComingSoon(model)) soon.push(model);
    else ready.push(model);
  }
  return [...ready, ...soon];
}

export function formatModelRating(value: number): string {
  const clamped = Math.min(5, Math.max(1, value));
  const rounded = Math.round(clamped * 10) / 10;
  return rounded % 1 === 0 ? `${rounded.toFixed(0)}.0` : rounded.toFixed(1);
}

export type CostTier = "cheap" | "medium" | "expensive";

/** cost score: 5 = cheapest, 1 = priciest */
export function costTierFromScore(costScore: number): CostTier {
  if (costScore >= 4.2) return "cheap";
  if (costScore >= 2.8) return "medium";
  return "expensive";
}

export const COST_TIER_STYLES: Record<CostTier, string> = {
  cheap: "bg-amber-400/15 text-amber-700 ring-amber-400/25",
  medium: "bg-orange-500/12 text-orange-600 ring-orange-500/20",
  expensive: "bg-red-500/12 text-red-600 ring-red-500/25",
};

export const COST_TIER_LABELS: Record<CostTier, string> = {
  cheap: "Cheap",
  medium: "Medium",
  expensive: "Expensive",
};
