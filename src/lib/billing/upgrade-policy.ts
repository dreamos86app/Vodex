import type { PlanId } from "@/lib/supabase/types";
import { normalizePlanId, PLAN_DISPLAY } from "@/lib/billing/plans";

/** Paddle subscription updates for plan upgrades — never prorate. */
export const PADDLE_UPGRADE_PRORATION_MODE = "full_immediately" as const;

export const UPGRADE_POLICY_COPY = {
  upgradeSummary:
    "Upgrading starts a new billing cycle immediately. Your monthly credits refresh to the new plan allowance.",
  amountDueToday: "Amount due today",
  noProration: "Plan upgrades are not prorated. You pay the full new plan price today.",
  downgradeSummary: "Downgrades apply at your next renewal. Your current plan stays active until then.",
} as const;

export type BillingInterval = "monthly" | "yearly";

const PLAN_RANK: Record<PlanId, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  business: 2,
  infinity: 3,
  enterprise: 3,
};

export function planRank(plan: string | null | undefined): number {
  return PLAN_RANK[normalizePlanId(plan ?? "free") as PlanId] ?? 0;
}

export function isPlanUpgrade(fromPlan: string, toPlan: string): boolean {
  return planRank(toPlan) > planRank(fromPlan);
}

export function isPlanDowngrade(fromPlan: string, toPlan: string): boolean {
  return planRank(toPlan) < planRank(fromPlan);
}

export function billingPeriodEndFromNow(interval: BillingInterval, from = new Date()): string {
  const end = new Date(from);
  if (interval === "yearly") {
    end.setUTCFullYear(end.getUTCFullYear() + 1);
  } else {
    end.setUTCMonth(end.getUTCMonth() + 1);
  }
  return end.toISOString();
}

export function fullPlanPriceUsd(plan: PlanId, interval: BillingInterval): number | null {
  const monthly = PLAN_DISPLAY[normalizePlanId(plan) as PlanId]?.priceMonthlyUsd;
  if (monthly == null) return null;
  if (interval === "yearly") {
    return Math.round(monthly * 12 * (1 - 0.2));
  }
  return monthly;
}
