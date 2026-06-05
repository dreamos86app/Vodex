/**
 * Discuss mode Build Credit pricing — cost-based, 5x minimum margin.
 * Client-safe (no server-only imports). Users never see model ids.
 */
import { USER_CREDITS_PER_USD } from "@/lib/billing/pricing-config";

export const DISCUSS_BC_TIER_STANDARD = 0.3;
export const DISCUSS_BC_TIER_PROTECTED = 0.4;
export const MIN_DISCUSS_MARGIN_MULTIPLIER = 5;

/** Hard cap — medium answers, protects margin on long threads. */
export const DISCUSS_MAX_OUTPUT_TOKENS = 1_536;
export const DISCUSS_MAX_INPUT_TOKENS = 6_000;

/** gpt-4o-mini medium turn (800 in / 600 out) — audit baseline. */
export const DEFAULT_DISCUSS_PROVIDER_COST_USD = 0.00048;

const CHEAP_MODEL_RATES = { in: 0.15, out: 0.6 };

export function estimateDiscussProviderCostUsd(
  inputTokens: number,
  outputTokens: number,
  rates = CHEAP_MODEL_RATES,
): number {
  return (inputTokens / 1_000_000) * rates.in + (outputTokens / 1_000_000) * rates.out;
}

export function discussRevenueUsd(buildCredits: number): number {
  return buildCredits / USER_CREDITS_PER_USD;
}

export function discussMarginMultiplier(buildCredits: number, providerCostUsd: number): number {
  if (providerCostUsd <= 0) return Number.POSITIVE_INFINITY;
  return discussRevenueUsd(buildCredits) / providerCostUsd;
}

export function resolveDiscussBuildCredits(providerCostUsd: number): number {
  const cost = Math.max(0, providerCostUsd);
  if (discussMarginMultiplier(DISCUSS_BC_TIER_STANDARD, cost) >= MIN_DISCUSS_MARGIN_MULTIPLIER) {
    return DISCUSS_BC_TIER_STANDARD;
  }
  return DISCUSS_BC_TIER_PROTECTED;
}

export function defaultDiscussProviderCostUsd(): number {
  return estimateDiscussProviderCostUsd(800, 600);
}

/** Active discuss charge — resolves tier from projected provider cost. */
export function discussCreditsToCharge(input?: {
  providerCostUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
}): number {
  const tokensIn = Math.min(input?.inputTokens ?? 800, DISCUSS_MAX_INPUT_TOKENS);
  const tokensOut = Math.min(input?.outputTokens ?? 600, DISCUSS_MAX_OUTPUT_TOKENS);
  const cost =
    input?.providerCostUsd ?? estimateDiscussProviderCostUsd(tokensIn, tokensOut);
  return resolveDiscussBuildCredits(cost);
}
