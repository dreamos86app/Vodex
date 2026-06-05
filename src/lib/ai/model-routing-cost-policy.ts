import "server-only";

import { resolveDiscussModel } from "@/lib/ai/provider-fallback";

/**
 * Cheapest safe models for Discuss — ordered by expected provider cost.
 * Never expose these ids in user-facing UI.
 */
export const CHEAP_DISCUSS_MODEL_PRIORITY = [
  "gpt-4o-mini",
  "gemini-2.0-flash",
  "claude-haiku-4-5",
] as const;

export function pickCheapestSafeDiscussModel(): string {
  for (const id of CHEAP_DISCUSS_MODEL_PRIORITY) {
    const resolved = resolveDiscussModel(id);
    if (resolved.modelId) return resolved.modelId;
  }
  return resolveDiscussModel(null).modelId;
}

/** Internal cost guardrails — USD per 1M tokens (approx, configurable). */
export const MODEL_COST_USD_PER_1M: Record<string, { in: number; out: number }> = {
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "gemini-2.0-flash": { in: 0.1, out: 0.4 },
  "claude-haiku-4-5": { in: 0.8, out: 4 },
  "gpt-4o": { in: 2.5, out: 10 },
  "claude-sonnet-4-6": { in: 3, out: 15 },
};

export function estimateDiscussMessageCostUsd(modelId: string, tokensIn: number, tokensOut: number): number {
  const rates = MODEL_COST_USD_PER_1M[modelId] ?? { in: 1, out: 3 };
  return (tokensIn / 1_000_000) * rates.in + (tokensOut / 1_000_000) * rates.out;
}
