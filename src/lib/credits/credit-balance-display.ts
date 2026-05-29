import type { CanonicalCreditBucket } from "@/lib/credits/canonical-credits";
import { formatCreditAmount } from "@/lib/credits/credit-summary";
import { monthlyTokensForPlan, normalizePlanId } from "@/lib/billing/plans";
import { monthlyActionCreditsForPlan } from "@/lib/action-credits/action-credit-allowances";

export type CreditBucketDisplay = {
  remaining: number;
  monthlyAllowance: number;
  bonusOrTopUp: number;
  displayText: string;
  secondaryText: string | null;
};

export type CreditBalanceDisplay = {
  plan: string;
  build: CreditBucketDisplay;
  action: CreditBucketDisplay;
  resetAt: string | null;
};

function planMonthlyAllowance(kind: "build" | "action", planId: string): number {
  const id = normalizePlanId(planId);
  return kind === "build" ? monthlyTokensForPlan(id) : monthlyActionCreditsForPlan(id);
}

/**
 * Canonical remaining / monthly display. Never shows impossible values like 100/30
 * without separating bonus credits.
 */
export function formatCreditBucketDisplay(
  bucket: CanonicalCreditBucket,
  kind: "build" | "action",
  planId: string,
  isConfirmed: boolean,
): CreditBucketDisplay {
  const monthlyAllowance = Math.max(
    isConfirmed && bucket.planAllowance > 0
      ? bucket.planAllowance
      : planMonthlyAllowance(kind, planId),
    0,
  );
  const explicitBonus = Math.max(bucket.bonusActive, 0);
  const rawRemaining = Math.max(0, bucket.available);

  const monthlyRemaining = Math.min(rawRemaining, monthlyAllowance);
  const bonusOrTopUp =
    explicitBonus > 0
      ? explicitBonus
      : Math.max(0, rawRemaining - monthlyAllowance);

  const displayText =
    bonusOrTopUp > 0.01
      ? `${formatCreditAmount(monthlyRemaining)}/${formatCreditAmount(monthlyAllowance)}`
      : `${formatCreditAmount(monthlyRemaining)}/${formatCreditAmount(monthlyAllowance)}`;

  const secondaryText =
    bonusOrTopUp > 0.01
      ? `+ ${formatCreditAmount(bonusOrTopUp)} bonus`
      : null;

  return {
    remaining: monthlyRemaining,
    monthlyAllowance,
    bonusOrTopUp,
    displayText,
    secondaryText,
  };
}

export function formatCreditBalanceDisplay(input: {
  build: CanonicalCreditBucket;
  action: CanonicalCreditBucket;
  planId: string;
  isConfirmed: boolean;
}): CreditBalanceDisplay {
  return {
    plan: normalizePlanId(input.planId),
    build: formatCreditBucketDisplay(input.build, "build", input.planId, input.isConfirmed),
    action: formatCreditBucketDisplay(input.action, "action", input.planId, input.isConfirmed),
    resetAt: input.build.resetDate ?? input.action.resetDate ?? null,
  };
}

/** Profile seed hint — clamp inflated profile balance before canonical API load. */
export function clampProfileSeedAvailable(
  rawAvailable: number,
  monthlyAllowance: number,
): { available: number; impliedBonus: number } {
  const allowance = Math.max(monthlyAllowance, 0);
  if (rawAvailable <= allowance) {
    return { available: rawAvailable, impliedBonus: 0 };
  }
  return { available: allowance, impliedBonus: rawAvailable - allowance };
}
