/**
 * DreamOS86 — canonical credit economics.
 *
 * Internal credits and user credits use DIFFERENT dollar rates:
 * - 30 internal credits = $1.00 provider cost
 * - 10 user credits     = $1.00 user revenue (list price)
 *
 * Target: charge enough user credits so revenue_usd >= provider_cost_usd × TARGET_REVENUE_MULTIPLIER
 */

/** Provider USD → internal cost ledger */
export const INTERNAL_CREDITS_PER_USD = 30;

/** User-facing revenue ledger */
export const USER_CREDITS_PER_USD = 10;

/** Required revenue dollars per $1 provider cost (3 = triple revenue vs cost) */
export const TARGET_REVENUE_MULTIPLIER = 3;

/** @deprecated Use TARGET_REVENUE_MULTIPLIER — old name implied internal×3 user credits (9× revenue) */
export const MIN_GROSS_MARKUP_MULTIPLIER = TARGET_REVENUE_MULTIPLIER;

/** Gross margin at exactly 3× revenue: (3-1)/3 ≈ 66.7% */
export const MIN_GROSS_MARGIN_DISPLAY = 1 - 1 / TARGET_REVENUE_MULTIPLIER;

export const USER_CREDIT_VALUE_USD = 1 / USER_CREDITS_PER_USD;
export const INTERNAL_CREDIT_COST_USD = 1 / INTERNAL_CREDITS_PER_USD;

export type GenerationMode = "discuss" | "edit" | "build" | "full_build" | "deploy" | "polish" | "repair";

export type ComplexityFloorKey =
  | "discuss"
  | "edit"
  | "polish"
  | "build_simple"
  | "build_medium"
  | "build_hard"
  | "deploy"
  | "repair";

/** Product pricing floors (not provider-cost math). May raise charge above minimum profitable amount. */
export const USER_CREDIT_FLOORS: Record<ComplexityFloorKey, number> = {
  discuss: 1,
  edit: 4,
  polish: 6,
  build_simple: 8,
  build_medium: 18,
  build_hard: 35,
  deploy: 5,
  repair: 6,
};

export function providerUsdToInternalCredits(providerCostUsd: number): number {
  if (!Number.isFinite(providerCostUsd) || providerCostUsd <= 0) return 0;
  return Math.ceil(providerCostUsd * INTERNAL_CREDITS_PER_USD);
}

export function internalCreditsToCostUsd(internalCostCredits: number): number {
  return internalCostCredits / INTERNAL_CREDITS_PER_USD;
}

export function userCreditsToRevenueUsd(userCredits: number): number {
  return userCredits / USER_CREDITS_PER_USD;
}

/**
 * Minimum user credits to hit TARGET_REVENUE_MULTIPLIER over provider cost.
 * Equivalent: ceil(provider_cost_usd × TARGET_REVENUE_MULTIPLIER × USER_CREDITS_PER_USD)
 */
export function minimumUserCreditsForProviderCost(providerCostUsd: number): number {
  if (!Number.isFinite(providerCostUsd) || providerCostUsd <= 0) return 0;
  // Integer micro-USD math avoids JS ceil(3.0000000004) === 4 on $0.10 provider cases
  const costMicro = Math.round(providerCostUsd * 1_000_000);
  const revenueMicro = costMicro * TARGET_REVENUE_MULTIPLIER;
  const userCreditMicro = revenueMicro * USER_CREDITS_PER_USD;
  return Math.ceil(userCreditMicro / 1_000_000);
}

/** Same as minimumUserCreditsForProviderCost but from internal ledger units */
export function minimumUserCreditsFromInternal(internalCostCredits: number): number {
  if (internalCostCredits <= 0) return 0;
  const costUsd = internalCreditsToCostUsd(internalCostCredits);
  return Math.ceil(costUsd * TARGET_REVENUE_MULTIPLIER * USER_CREDITS_PER_USD);
}

export function grossMarginFromCharge(userCredits: number, providerCostUsd: number): number {
  const revenueUsd = userCreditsToRevenueUsd(userCredits);
  const costUsd = providerCostUsd;
  if (revenueUsd <= 0) return 0;
  return Math.max(0, (revenueUsd - costUsd) / revenueUsd);
}

export function revenueMultiplierFromCharge(userCredits: number, providerCostUsd: number): number {
  const revenueUsd = userCreditsToRevenueUsd(userCredits);
  if (providerCostUsd <= 0) return Number.POSITIVE_INFINITY;
  return revenueUsd / providerCostUsd;
}

export function complexityFloorKey(
  mode: GenerationMode,
  complexity = 5,
): ComplexityFloorKey {
  if (mode === "discuss") return "discuss";
  if (mode === "edit") return "edit";
  if (mode === "polish") return "polish";
  if (mode === "repair") return "polish";
  if (mode === "deploy") return "deploy";
  if (complexity >= 8) return "build_hard";
  if (complexity >= 5) return "build_medium";
  return "build_simple";
}
