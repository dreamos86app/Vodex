import { billablePlanDefinition } from "@/lib/billing/billable-plans";
import {
  billablePlanFromStoragePlanId,
  billablePlanToPlanId,
  catalogAmountUsd,
  type BillablePlanId,
  type CatalogBillingInterval,
} from "@/lib/billing/plan-billing-catalog";
import {
  isHighestPaidPlan,
  isPlanDowngrade,
  isPlanUpgrade,
  nextUpgradePlanId,
  planRank,
  UPGRADE_POLICY_COPY,
} from "@/lib/billing/upgrade-policy";
import { normalizePlanId, PLAN_DISPLAY } from "@/lib/billing/plans";
import type { PlanId } from "@/lib/supabase/types";

export type PlanChangeAction =
  | "checkout"
  | "portal"
  | "schedule_downgrade"
  | "same_plan"
  | "highest_plan"
  | "blocked";

export type PlanChangeBillingIntent =
  | "new_subscription"
  | "upgrade"
  | "downgrade"
  | "interval_change"
  | "same_plan"
  | "cancel";

export type PlanChangeSource =
  | "owner_test_checkout"
  | "billing_page"
  | "pricing_page"
  | "portal";

export type ResolvedPlanChange = {
  action: PlanChangeAction;
  label: string;
  description: string;
  requiresConfirmation: boolean;
  confirmationMessage?: string;
  targetPlan: BillablePlanId;
  targetInterval: CatalogBillingInterval;
  currentPlanId: PlanId;
  currentInterval: CatalogBillingInterval | null;
  billingIntent: PlanChangeBillingIntent;
  targetMonthlyUsd: number;
};

function storageToBillable(planId: string): BillablePlanId | null {
  return billablePlanFromStoragePlanId(normalizePlanId(planId));
}

export function resolvePlanChange(input: {
  currentPlanId: string;
  currentInterval?: CatalogBillingInterval | null;
  targetPlan: BillablePlanId;
  targetInterval: CatalogBillingInterval;
}): ResolvedPlanChange {
  const current = normalizePlanId(input.currentPlanId);
  const currentBillable = storageToBillable(current);
  const target = input.targetPlan;
  const targetInterval = input.targetInterval;
  const targetName = billablePlanDefinition(target).label;
  const targetMonthlyUsd = catalogAmountUsd(target, targetInterval);

  const base = {
    targetPlan: target,
    targetInterval,
    currentPlanId: current,
    currentInterval: input.currentInterval ?? null,
    targetMonthlyUsd,
  };

  if (isHighestPaidPlan(current) && !isPlanUpgrade(current, billablePlanToPlanId(target))) {
    return {
      ...base,
      action: "highest_plan",
      label: "Highest plan",
      description: "You are on Infinity VII — the highest DreamOS86 plan.",
      requiresConfirmation: false,
      billingIntent: "same_plan",
    };
  }

  const sameStoragePlan =
    currentBillable === target &&
    (input.currentInterval == null || input.currentInterval === targetInterval);

  if (sameStoragePlan) {
    const otherInterval: CatalogBillingInterval =
      targetInterval === "monthly" ? "annual" : "monthly";
    return {
      ...base,
      action: "same_plan",
      label: "Current plan",
      description: `You are already on ${targetName} (${targetInterval}).`,
      requiresConfirmation: false,
      billingIntent: "same_plan",
      confirmationMessage:
        targetInterval === "monthly"
          ? `Switch to annual billing and save 20% — use “Switch to annual” instead of starting a new checkout.`
          : undefined,
    };
  }

  if (
    currentBillable === target &&
    input.currentInterval != null &&
    input.currentInterval !== targetInterval
  ) {
    return {
      ...base,
      action: "portal",
      label: targetInterval === "annual" ? "Switch to annual" : "Switch to monthly",
      description:
        targetInterval === "annual"
          ? "Change billing cycle in your Paddle subscription portal — avoids duplicate subscriptions."
          : "Manage billing interval in your Paddle customer portal.",
      requiresConfirmation: false,
      billingIntent: "interval_change",
    };
  }

  if (isPlanDowngrade(current, billablePlanToPlanId(target))) {
    const periodNote = UPGRADE_POLICY_COPY.downgradeSummary;
    return {
      ...base,
      action: "schedule_downgrade",
      label: `Schedule downgrade to ${targetName}`,
      description: periodNote,
      requiresConfirmation: true,
      confirmationMessage: `Your ${PLAN_DISPLAY[current]?.name ?? current} plan stays active until the end of the current billing period. ${targetName} starts at the next renewal.`,
      billingIntent: "downgrade",
    };
  }

  if (current === "free" || isPlanUpgrade(current, billablePlanToPlanId(target))) {
    return {
      ...base,
      action: "checkout",
      label: current === "free" ? `Get ${targetName}` : `Upgrade to ${targetName}`,
      description: UPGRADE_POLICY_COPY.upgradeSummary,
      requiresConfirmation: true,
      confirmationMessage:
        current === "free"
          ? `Start ${targetName} (${targetInterval}) — credits refresh after payment confirms.`
          : `Upgrade to ${targetName} starts a new billing cycle immediately. Full plan price due today.`,
      billingIntent: current === "free" ? "new_subscription" : "upgrade",
    };
  }

  return {
    ...base,
    action: "portal",
    label: "Manage subscription",
    description: "Manage plan changes in your Paddle customer portal.",
    requiresConfirmation: false,
    billingIntent: "upgrade",
  };
}

export function recommendedUpgradeTarget(currentPlanId: string): BillablePlanId | null {
  const next = nextUpgradePlanId(currentPlanId);
  if (!next || next === "free") return null;
  return billablePlanFromStoragePlanId(next);
}

export function comparePlanRank(a: string, b: string): number {
  return planRank(a) - planRank(b);
}
