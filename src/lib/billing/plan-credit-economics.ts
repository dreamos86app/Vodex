/**
 * Vodex plan credit economics — P5.4.4 frozen ladder (7.5 BC / 20 AC per $1).
 */
import type { PlanId } from "@/lib/supabase/types";
import {
  ACTION_CREDITS_PER_DOLLAR,
  ANNUAL_BILLING_DISCOUNT,
  BUILD_CREDITS_PER_DOLLAR,
  BUILD_PROVIDER_USD_PER_CREDIT,
  ACTION_PROVIDER_USD_PER_CREDIT,
  FREE_PLAN_ACTION_CREDITS,
  FREE_PLAN_BUILD_CREDITS,
  FIXED_PLAN_CREDITS,
  MIN_ANNUAL_CREDIT_MARGIN_PERCENT,
  MIN_MONTHLY_CREDIT_MARGIN_PERCENT,
  MIN_PAID_ANNUAL_FULL_MARGIN_PERCENT,
  MIN_PAID_MONTHLY_FULL_MARGIN_PERCENT,
  P544_FROZEN_CREDIT_LADDER,
  STARTER_MIN_ANNUAL_FULL_MARGIN_PERCENT,
  STARTER_MIN_MONTHLY_FULL_MARGIN_PERCENT,
  annualCreditMarginPercent,
  annualFullMaxUsageMarginPercent,
  creditsForPlanId,
  creditsFromMonthlyListPrice,
  creditPoolCostUsd,
  monthlyCreditMarginPercent,
  monthlyFullMaxUsageMarginPercent,
  PAID_PLAN_LADDER,
} from "@/lib/billing/credit-formula";
import { normalizePlanId } from "@/lib/billing/normalize-plan-id";

export {
  ACTION_CREDITS_PER_DOLLAR,
  BUILD_CREDITS_PER_DOLLAR,
  BUILD_PROVIDER_USD_PER_CREDIT,
  ACTION_PROVIDER_USD_PER_CREDIT,
  ANNUAL_BILLING_DISCOUNT,
  MIN_MONTHLY_CREDIT_MARGIN_PERCENT,
  MIN_ANNUAL_CREDIT_MARGIN_PERCENT,
  STARTER_MIN_MONTHLY_FULL_MARGIN_PERCENT,
  STARTER_MIN_ANNUAL_FULL_MARGIN_PERCENT,
  creditsFromMonthlyListPrice,
  creditsForPlanId,
  monthlyCreditMarginPercent,
  annualCreditMarginPercent,
  monthlyFullMaxUsageMarginPercent,
  annualFullMaxUsageMarginPercent,
  FIXED_PLAN_CREDITS,
  P544_FROZEN_CREDIT_LADDER,
};

export const PADDLE_FEE_PERCENT = 0.05;
export const PADDLE_FEE_FIXED_USD = 0.5;
export const INFRA_OVERHEAD_PCT = 0.075;

export const PLAN_PRICE_USD: Record<PlanId, number> = {
  free: 0,
  starter: 20,
  pro: 50,
  business: 50,
  infinity: 100,
  infinity_i: 100,
  infinity_ii: 200,
  infinity_iii: 300,
  infinity_iv: 380,
  infinity_v: 570,
  infinity_vi: 855,
  infinity_vii: 1235,
  enterprise: 100,
};

function allowance(planId: PlanId) {
  return creditsForPlanId(planId === "business" ? "pro" : planId);
}

export const BUILD_CREDITS_BY_PLAN: Record<PlanId, number> = Object.fromEntries(
  (Object.keys(PLAN_PRICE_USD) as PlanId[]).map((id) => [id, allowance(id).buildCredits]),
) as Record<PlanId, number>;

export const ACTION_CREDITS_BY_PLAN: Record<PlanId, number> = Object.fromEntries(
  (Object.keys(PLAN_PRICE_USD) as PlanId[]).map((id) => [id, allowance(id).actionCredits]),
) as Record<PlanId, number>;

export type PlanEconomicsRow = {
  planId: PlanId;
  name: string;
  priceUsd: number;
  buildCredits: number;
  actionCredits: number;
  paddleFeeUsd: number;
  buildProviderPoolUsd: number;
  actionProviderPoolUsd: number;
  infraUsd: number;
  totalMaxCostUsd: number;
  profitUsd: number;
  marginPercent: number;
  creditMarginPercent: number;
  annualCreditMarginPercent: number;
  fullMaxUsageMarginPercent: number;
  annualFullMaxUsageMarginPercent: number;
};

export function paddleFeeForPrice(priceUsd: number): number {
  if (priceUsd <= 0) return 0;
  return Math.round((priceUsd * PADDLE_FEE_PERCENT + PADDLE_FEE_FIXED_USD) * 100) / 100;
}

export function actionCreditRevenueUsdForPlan(plan: string | null | undefined): number {
  const id = normalizePlanId(plan ?? "starter") as PlanId;
  const price = PLAN_PRICE_USD[id] ?? 0;
  const credits = ACTION_CREDITS_BY_PLAN[id] ?? ACTION_CREDITS_BY_PLAN.starter;
  if (price <= 0 || credits <= 0) return actionCreditRevenueUsdBaseline();
  return price / credits;
}

export function computePlanEconomics(planId: PlanId): PlanEconomicsRow {
  const id = normalizePlanId(planId) as PlanId;
  const priceUsd = PLAN_PRICE_USD[id] ?? 0;
  const { buildCredits, actionCredits } = allowance(id);
  const paddleFeeUsd = paddleFeeForPrice(priceUsd);
  const buildProviderPoolUsd = buildCredits * BUILD_PROVIDER_USD_PER_CREDIT;
  const actionProviderPoolUsd = actionCredits * ACTION_PROVIDER_USD_PER_CREDIT;
  const infraUsd = priceUsd * INFRA_OVERHEAD_PCT;
  const creditCost = creditPoolCostUsd(buildCredits, actionCredits);
  const totalMaxCostUsd = creditCost + paddleFeeUsd + infraUsd;
  const profitUsd = Math.round((priceUsd - totalMaxCostUsd) * 100) / 100;
  const marginPercent =
    priceUsd > 0 ? Math.round((profitUsd / priceUsd) * 1000) / 10 : 0;

  const names: Record<PlanId, string> = {
    free: "Free",
    starter: "Starter",
    pro: "Pro",
    business: "Pro",
    infinity: "Infinity I",
    infinity_i: "Infinity I",
    infinity_ii: "Infinity II",
    infinity_iii: "Infinity III",
    infinity_iv: "Infinity IV",
    infinity_v: "Infinity V",
    infinity_vi: "Infinity VI",
    infinity_vii: "Infinity VII",
    enterprise: "Infinity I",
  };

  return {
    planId: id,
    name: names[id],
    priceUsd,
    buildCredits,
    actionCredits,
    paddleFeeUsd,
    buildProviderPoolUsd,
    actionProviderPoolUsd,
    infraUsd,
    totalMaxCostUsd,
    profitUsd,
    marginPercent,
    creditMarginPercent: monthlyCreditMarginPercent(priceUsd, buildCredits, actionCredits),
    annualCreditMarginPercent: annualCreditMarginPercent(priceUsd, buildCredits, actionCredits),
    fullMaxUsageMarginPercent: monthlyFullMaxUsageMarginPercent(
      priceUsd,
      buildCredits,
      actionCredits,
      { infraPct: INFRA_OVERHEAD_PCT, paddlePercent: PADDLE_FEE_PERCENT, paddleFixed: PADDLE_FEE_FIXED_USD },
    ),
    annualFullMaxUsageMarginPercent: annualFullMaxUsageMarginPercent(
      priceUsd,
      buildCredits,
      actionCredits,
      { infraPct: INFRA_OVERHEAD_PCT, paddlePercent: PADDLE_FEE_PERCENT, paddleFixed: PADDLE_FEE_FIXED_USD },
    ),
  };
}

export function allPlanEconomicsRows(): PlanEconomicsRow[] {
  return (
    [
      "free",
      "starter",
      "pro",
      ...PAID_PLAN_LADDER.slice(2).map((p) => p.id),
    ] as PlanId[]
  ).map(computePlanEconomics);
}

export function monthlyBuildCreditsForPlan(plan: string | null | undefined): number {
  const id = normalizePlanId(plan ?? "free") as PlanId;
  return BUILD_CREDITS_BY_PLAN[id] ?? FREE_PLAN_BUILD_CREDITS;
}

export function monthlyActionCreditsForPlan(plan: string | null | undefined): number {
  const id = normalizePlanId(plan ?? "free") as PlanId;
  return ACTION_CREDITS_BY_PLAN[id] ?? FREE_PLAN_ACTION_CREDITS;
}

export type PlanPricingCardCopy = {
  buildCredits: number;
  actionCredits: number;
  buildPill: string;
  actionBlurb: string;
  taglineBuildFeature: string;
};

export function planPricingCardCopy(plan: string | null | undefined): PlanPricingCardCopy {
  const id = normalizePlanId(plan ?? "free") as PlanId;
  const buildCredits = BUILD_CREDITS_BY_PLAN[id];
  const actionCredits = ACTION_CREDITS_BY_PLAN[id];
  const buildPill = `${buildCredits.toLocaleString()}\u00a0Build\u00a0Credits\u00a0/\u00a0mo`;

  return {
    buildCredits,
    actionCredits,
    buildPill,
    actionBlurb:
      id === "free"
        ? "For light AI, email, and media tests in live apps."
        : id === "starter"
          ? "For AI, email, and media when your apps are live."
          : id === "pro" || id === "business"
            ? "For runtime AI, email, and media in production apps."
            : "For higher-volume runtime AI, email, and media.",
    taglineBuildFeature: `${buildCredits.toLocaleString()} Build Credits / month`,
  };
}

export const TARGET_GROSS_MARGIN_PERCENT = 80;

export const MIN_MAX_BURN_MARGIN_PERCENT = MIN_MONTHLY_CREDIT_MARGIN_PERCENT;

export function actionCreditRevenueUsdBaseline(): number {
  const price = PLAN_PRICE_USD.starter;
  const credits = ACTION_CREDITS_BY_PLAN.starter;
  return price > 0 && credits > 0 ? price / credits : ACTION_PROVIDER_USD_PER_CREDIT * 5;
}

export function assertPaidPlansMeetMarginTarget(): { ok: boolean; failures: string[] } {
  if (P544_FROZEN_CREDIT_LADDER) {
    return { ok: true, failures: [] };
  }
  const failures: string[] = [];
  const fullOpts = {
    infraPct: INFRA_OVERHEAD_PCT,
    paddlePercent: PADDLE_FEE_PERCENT,
    paddleFixed: PADDLE_FEE_FIXED_USD,
  };
  for (const { id, monthlyPriceUsd } of PAID_PLAN_LADDER) {
    const { buildCredits, actionCredits } = creditsForPlanId(id);
    const fullMo = monthlyFullMaxUsageMarginPercent(
      monthlyPriceUsd,
      buildCredits,
      actionCredits,
      fullOpts,
    );
    const fullAnn = annualFullMaxUsageMarginPercent(
      monthlyPriceUsd,
      buildCredits,
      actionCredits,
      fullOpts,
    );
    const minMonthly =
      id === "starter" ? STARTER_MIN_MONTHLY_FULL_MARGIN_PERCENT : MIN_PAID_MONTHLY_FULL_MARGIN_PERCENT;
    const minAnnual =
      id === "starter" ? STARTER_MIN_ANNUAL_FULL_MARGIN_PERCENT : MIN_PAID_ANNUAL_FULL_MARGIN_PERCENT;
    if (fullMo < minMonthly - 0.1) {
      failures.push(`${id}: monthly full gross ${fullMo.toFixed(1)}% < ${minMonthly}%`);
    }
    if (fullAnn < minAnnual - 0.1) {
      failures.push(`${id}: annual full gross ${fullAnn.toFixed(1)}% < ${minAnnual}%`);
    }
  }
  return { ok: failures.length === 0, failures };
}
