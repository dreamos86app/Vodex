/**
 * Hard profit guard — every quoted action must meet minimum margin.
 */
import { quoteActionCredits } from "@/lib/action-credits/action-credit-pricing";
import { applyBuildCreditPricing } from "@/lib/billing/build-credit-floors";
import type { BuildCreditOperationType } from "@/lib/billing/build-credit-floors";
import {
  actionCreditRevenueUsdForPlan,
  ACTION_CREDITS_PER_DOLLAR,
  BUILD_PROVIDER_USD_PER_CREDIT,
} from "@/lib/billing/plan-credit-economics";
import { USER_CREDITS_PER_USD } from "@/lib/billing/pricing-config";
import { resolveDiscussBuildCredits } from "@/lib/billing/discuss-credit-pricing";

export const MIN_MARGIN_MULTIPLIER = 5;
export const MIN_MAX_BURN_MARGIN_PERCENT = 75;
export const TARGET_BLENDED_MARGIN_PERCENT = 80;

export type ProfitGuardInput = {
  kind: "build" | "action" | "discuss";
  providerCostUsd: number;
  infrastructureCostUsd?: number;
  creditCost: number;
  planId?: string | null;
  actionType?: string;
  operationType?: BuildCreditOperationType;
};

export type ProfitGuardResult = {
  ok: boolean;
  totalCostUsd: number;
  expectedRevenueUsd: number;
  marginMultiplier: number;
  marginPercent: number;
  adjustedCreditCost?: number;
  error?: string;
};

export function totalActionCostUsd(providerCostUsd: number, infrastructureCostUsd = 0): number {
  return Math.max(0, providerCostUsd) + Math.max(0, infrastructureCostUsd);
}

export function expectedBuildRevenueUsd(credits: number): number {
  return credits / USER_CREDITS_PER_USD;
}

export function expectedActionRevenueUsd(credits: number, planId?: string | null): number {
  return credits * actionCreditRevenueUsdForPlan(planId ?? "starter");
}

export function assertProfitGuard(input: ProfitGuardInput): ProfitGuardResult {
  const infra = input.infrastructureCostUsd ?? 0;
  const totalCost = totalActionCostUsd(input.providerCostUsd, infra);

  if (input.kind === "discuss") {
    const credits = input.creditCost > 0 ? input.creditCost : resolveDiscussBuildCredits(totalCost);
    const revenue = expectedBuildRevenueUsd(credits);
    const mult = totalCost > 0 ? revenue / totalCost : MIN_MARGIN_MULTIPLIER;
    const marginPercent = revenue > 0 ? ((revenue - totalCost) / revenue) * 100 : 0;
    if (mult < MIN_MARGIN_MULTIPLIER - 0.01) {
      const adjusted = resolveDiscussBuildCredits(totalCost);
      return {
        ok: adjusted * (1 / USER_CREDITS_PER_USD) >= totalCost * MIN_MARGIN_MULTIPLIER,
        totalCostUsd: totalCost,
        expectedRevenueUsd: expectedBuildRevenueUsd(adjusted),
        marginMultiplier: mult,
        marginPercent,
        adjustedCreditCost: adjusted,
        error: "discuss_below_min_margin",
      };
    }
    return { ok: true, totalCostUsd: totalCost, expectedRevenueUsd: revenue, marginMultiplier: mult, marginPercent };
  }

  if (input.kind === "action") {
    const quote = quoteActionCredits({
      actionType: input.actionType ?? "llm_small",
      providerCostUsd: totalCost,
    });
    const credits = Math.max(input.creditCost, quote.finalActionCredits);
    const revenue = expectedActionRevenueUsd(credits, input.planId);
    const mult = totalCost > 0 ? revenue / totalCost : MIN_MARGIN_MULTIPLIER;
    const marginPercent = revenue > 0 ? ((revenue - totalCost) / revenue) * 100 : 0;
    if (mult < MIN_MARGIN_MULTIPLIER - 0.01) {
      const needed = Math.ceil((totalCost * MIN_MARGIN_MULTIPLIER) / actionCreditRevenueUsdForPlan(input.planId ?? "starter"));
      return {
        ok: false,
        totalCostUsd: totalCost,
        expectedRevenueUsd: revenue,
        marginMultiplier: mult,
        marginPercent,
        adjustedCreditCost: needed,
        error: "action_below_min_margin",
      };
    }
    return { ok: true, totalCostUsd: totalCost, expectedRevenueUsd: revenue, marginMultiplier: mult, marginPercent };
  }

  const op = input.operationType ?? "normal_edit";
  const applied = applyBuildCreditPricing({ operationType: op, providerCostUsd: totalCost });
  const credits = Math.max(input.creditCost, applied.userCreditsRequired);
  const revenue = expectedBuildRevenueUsd(credits);
  const mult = totalCost > 0 ? revenue / totalCost : MIN_MARGIN_MULTIPLIER;
  const marginPercent = revenue > 0 ? ((revenue - totalCost) / revenue) * 100 : 0;
  if (mult < MIN_MARGIN_MULTIPLIER - 0.01) {
    return {
      ok: false,
      totalCostUsd: totalCost,
      expectedRevenueUsd: revenue,
      marginMultiplier: mult,
      marginPercent,
      adjustedCreditCost: applied.userCreditsRequired,
      error: "build_below_min_margin",
    };
  }
  return { ok: true, totalCostUsd: totalCost, expectedRevenueUsd: revenue, marginMultiplier: mult, marginPercent };
}

/** Subscription AC/$ ratio — 20 AC per $1 on paid plans (P5.4.2). */
export function actionCreditsForPlanPrice(priceUsd: number): number {
  if (priceUsd <= 0) return 20;
  return Math.round(priceUsd * ACTION_CREDITS_PER_DOLLAR);
}

export { BUILD_PROVIDER_USD_PER_CREDIT };
