/**
 * DreamOS86 plan credit economics — single source for allowances and provider pools.
 * Paddle fee model for DreamOS86 subscription billing (not generated-app payments).
 */

import type { PlanId } from "@/lib/supabase/types";
import { ACTION_CREDITS_PER_DOLLAR } from "@/lib/billing/billing-constants";
import { normalizePlanId } from "@/lib/billing/normalize-plan-id";

export { ACTION_CREDITS_PER_DOLLAR };

/** Max provider USD per Build Credit when plan allowance is fully utilized. */
export const BUILD_PROVIDER_USD_PER_CREDIT = 0.02;

/** Max provider USD per Action Credit when plan allowance is fully utilized. */
export const ACTION_PROVIDER_USD_PER_CREDIT = 0.005;

/** Paddle checkout fee: 5% + $0.50 per transaction (DreamOS86 billing). */
export const PADDLE_FEE_PERCENT = 0.05;
export const PADDLE_FEE_FIXED_USD = 0.5;

/** Monthly USD for Infinity tiers (volume discount applied on IV–VII). Keep in sync with billable-plans. */
const INFINITY_MONTHLY_USD: Record<string, number> = {
  infinity_i: 100,
  infinity_ii: 200,
  infinity_iii: 300,
  infinity_iv: 380,
  infinity_v: 570,
  infinity_vi: 855,
  infinity_vii: 1235,
};

const INFINITY_BUILD: Record<string, number> = {
  infinity: 1_000,
  infinity_i: 1_000,
  infinity_ii: 2_000,
  infinity_iii: 3_000,
  infinity_iv: 4_000,
  infinity_v: 6_000,
  infinity_vi: 9_000,
  infinity_vii: 13_000,
  enterprise: 1_000,
};

function infinityActionCredits(plan: PlanId): number {
  const slug = plan === "infinity" || plan === "enterprise" ? "infinity_i" : plan;
  const monthly = INFINITY_MONTHLY_USD[slug];
  if (monthly != null) return monthly * ACTION_CREDITS_PER_DOLLAR;
  return 2_500;
}

export const BUILD_CREDITS_BY_PLAN: Record<PlanId, number> = {
  free: 30,
  starter: 200,
  pro: 500,
  business: 500,
  infinity: INFINITY_BUILD.infinity_i,
  infinity_i: INFINITY_BUILD.infinity_i,
  infinity_ii: INFINITY_BUILD.infinity_ii,
  infinity_iii: INFINITY_BUILD.infinity_iii,
  infinity_iv: INFINITY_BUILD.infinity_iv,
  infinity_v: INFINITY_BUILD.infinity_v,
  infinity_vi: INFINITY_BUILD.infinity_vi,
  infinity_vii: INFINITY_BUILD.infinity_vii,
  enterprise: INFINITY_BUILD.infinity_i,
};

export const ACTION_CREDITS_BY_PLAN: Record<PlanId, number> = {
  free: 25,
  starter: 500,
  pro: 1_250,
  business: 1_250,
  infinity: infinityActionCredits("infinity_i"),
  infinity_i: infinityActionCredits("infinity_i"),
  infinity_ii: infinityActionCredits("infinity_ii"),
  infinity_iii: infinityActionCredits("infinity_iii"),
  infinity_iv: infinityActionCredits("infinity_iv"),
  infinity_v: infinityActionCredits("infinity_v"),
  infinity_vi: infinityActionCredits("infinity_vi"),
  infinity_vii: infinityActionCredits("infinity_vii"),
  enterprise: infinityActionCredits("infinity_i"),
};

export const PLAN_PRICE_USD: Record<PlanId, number> = {
  free: 0,
  starter: 20,
  pro: 50,
  business: 50,
  infinity: INFINITY_MONTHLY_USD.infinity_i,
  infinity_i: INFINITY_MONTHLY_USD.infinity_i,
  infinity_ii: INFINITY_MONTHLY_USD.infinity_ii,
  infinity_iii: INFINITY_MONTHLY_USD.infinity_iii,
  infinity_iv: INFINITY_MONTHLY_USD.infinity_iv,
  infinity_v: INFINITY_MONTHLY_USD.infinity_v,
  infinity_vi: INFINITY_MONTHLY_USD.infinity_vi,
  infinity_vii: INFINITY_MONTHLY_USD.infinity_vii,
  enterprise: INFINITY_MONTHLY_USD.infinity_i,
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

  const highVolume =
    "For higher-volume runtime AI, email, and media.";

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
            : highVolume,
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
