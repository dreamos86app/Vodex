/**
 * DreamOS86 plan credit economics — single source for allowances and provider pools.
 * Paddle fee model for DreamOS86 subscription billing (not generated-app payments).
 */

import type { PlanId } from "@/lib/supabase/types";
import { normalizePlanId } from "@/lib/billing/normalize-plan-id";

/** Max provider USD per Build Credit when plan allowance is fully utilized. */
export const BUILD_PROVIDER_USD_PER_CREDIT = 0.02;

/** Max provider USD per Action Credit when plan allowance is fully utilized. */
export const ACTION_PROVIDER_USD_PER_CREDIT = 0.005;

/** Action Credits granted per $1 of subscription price (Starter $20 → 500). */
export const ACTION_CREDITS_PER_DOLLAR = 25;

/** Paddle checkout fee: 5% + $0.50 per transaction (DreamOS86 billing). */
export const PADDLE_FEE_PERCENT = 0.05;
export const PADDLE_FEE_FIXED_USD = 0.5;

export const BUILD_CREDITS_BY_PLAN: Record<PlanId, number> = {
  free: 30,
  starter: 200,
  pro: 500,
  business: 500,
  infinity: 1_000,
  enterprise: 1_000,
};

export const ACTION_CREDITS_BY_PLAN: Record<PlanId, number> = {
  free: 25,
  starter: 500,
  pro: 1_250,
  business: 1_250,
  infinity: 2_500,
  enterprise: 2_500,
};

export const PLAN_PRICE_USD: Record<PlanId, number> = {
  free: 0,
  starter: 20,
  pro: 50,
  business: 50,
  infinity: 100,
  enterprise: 100,
};

export type PlanEconomicsRow = {
  planId: PlanId;
  name: string;
  priceUsd: number;
  buildCredits: number;
  actionCredits: number;
  paddleFeeUsd: number;
  buildProviderPoolUsd: number;
  actionProviderPoolUsd: number;
  totalMaxCostUsd: number;
  profitUsd: number;
  marginPercent: number;
};

export function paddleFeeForPrice(priceUsd: number): number {
  if (priceUsd <= 0) return 0;
  return Math.round((priceUsd * PADDLE_FEE_PERCENT + PADDLE_FEE_FIXED_USD) * 100) / 100;
}

export function computePlanEconomics(planId: PlanId): PlanEconomicsRow {
  const id = normalizePlanId(planId) as PlanId;
  const priceUsd = PLAN_PRICE_USD[id] ?? 0;
  const buildCredits = BUILD_CREDITS_BY_PLAN[id];
  const actionCredits = ACTION_CREDITS_BY_PLAN[id];
  const paddleFeeUsd = paddleFeeForPrice(priceUsd);
  const buildProviderPoolUsd = buildCredits * BUILD_PROVIDER_USD_PER_CREDIT;
  const actionProviderPoolUsd = actionCredits * ACTION_PROVIDER_USD_PER_CREDIT;
  const totalMaxCostUsd = paddleFeeUsd + buildProviderPoolUsd + actionProviderPoolUsd;
  const profitUsd = Math.round((priceUsd - totalMaxCostUsd) * 100) / 100;
  const marginPercent =
    priceUsd > 0 ? Math.round((profitUsd / priceUsd) * 1000) / 10 : 0;

  const names: Record<PlanId, string> = {
    free: "Free",
    starter: "Starter",
    pro: "Pro",
    business: "Pro",
    infinity: "Infinity",
    enterprise: "Infinity",
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
    totalMaxCostUsd,
    profitUsd,
    marginPercent,
  };
}

export function allPlanEconomicsRows(): PlanEconomicsRow[] {
  return (["free", "starter", "pro", "infinity"] as PlanId[]).map(computePlanEconomics);
}

export function monthlyBuildCreditsForPlan(plan: string | null | undefined): number {
  const id = normalizePlanId(plan ?? "free") as PlanId;
  return BUILD_CREDITS_BY_PLAN[id] ?? BUILD_CREDITS_BY_PLAN.free;
}

export function monthlyActionCreditsForPlan(plan: string | null | undefined): number {
  const id = normalizePlanId(plan ?? "free") as PlanId;
  return ACTION_CREDITS_BY_PLAN[id] ?? ACTION_CREDITS_BY_PLAN.free;
}

export type PlanPricingCardCopy = {
  buildCredits: number;
  actionCredits: number;
  /** Single-line hero label for the pricing card. */
  buildPill: string;
  /** Short description under Action Credits at card bottom. */
  actionBlurb: string;
  taglineBuildFeature: string;
};

export function planPricingCardCopy(plan: string | null | undefined): PlanPricingCardCopy {
  const id = normalizePlanId(plan ?? "free") as PlanId;
  const buildCredits = BUILD_CREDITS_BY_PLAN[id];
  const actionCredits = ACTION_CREDITS_BY_PLAN[id];
  const buildPill = `${buildCredits.toLocaleString()}\u00a0Build\u00a0Credits\u00a0/\u00a0mo`;

  const actionBlurbByPlan: Record<PlanId, string> = {
    free: "For light AI, email, and media tests in live apps.",
    starter: "For AI, email, and media when your apps are live.",
    pro: "For runtime AI, email, and media in production apps.",
    business: "For runtime AI, email, and media in production apps.",
    infinity: "For higher-volume runtime AI, email, and media.",
    enterprise: "For higher-volume runtime AI, email, and media.",
  };

  return {
    buildCredits,
    actionCredits,
    buildPill,
    actionBlurb: actionBlurbByPlan[id],
    taglineBuildFeature: `${buildCredits.toLocaleString()} Build Credits / month`,
  };
}

/** Minimum margin at full burn before blocking plan launch (paid plans). */
export const MIN_PAID_PLAN_MARGIN_PERCENT = 55;

export function assertPaidPlansMeetMarginTarget(): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  for (const id of ["starter", "pro", "infinity"] as PlanId[]) {
    const row = computePlanEconomics(id);
    if (row.marginPercent < MIN_PAID_PLAN_MARGIN_PERCENT) {
      failures.push(
        `${row.name}: margin ${row.marginPercent}% < ${MIN_PAID_PLAN_MARGIN_PERCENT}%`,
      );
    }
  }
  return { ok: failures.length === 0, failures };
}
