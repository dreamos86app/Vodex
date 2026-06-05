/**
 * P5.4.4 — Frozen plan allowances + margin optimization via action/provider tuning.
 * Monthly list price is source of truth. Annual discount does not reduce credits.
 */
import { ACTION_CREDITS_PER_DOLLAR } from "@/lib/billing/billing-constants";

export { ACTION_CREDITS_PER_DOLLAR };

/** Build Credits per $1 monthly list price (product shape). */
export const BUILD_CREDITS_PER_DOLLAR = 7.5;

export const FREE_PLAN_BUILD_CREDITS = 20;
export const FREE_PLAN_ACTION_CREDITS = 20;

export const BUILD_PROVIDER_USD_PER_CREDIT = 0.02;
export const ACTION_PROVIDER_USD_PER_CREDIT = 0.003;

export const ANNUAL_BILLING_DISCOUNT = 0.2;

/** P5.4.4 — allowances frozen; per-plan full-gross max-burn is informational only. */
export const P544_FROZEN_CREDIT_LADDER = true;

/** Credit-pool margin floors (provider cost only). */
export const MIN_MONTHLY_CREDIT_MARGIN_PERCENT = 75;
export const MIN_ANNUAL_CREDIT_MARGIN_PERCENT = 65;

/** Full gross targets (informational under frozen ladder — see P5.4.4 rationale). */
export const STARTER_MIN_MONTHLY_FULL_MARGIN_PERCENT = 77;
export const STARTER_MIN_ANNUAL_FULL_MARGIN_PERCENT = 68;
export const MIN_PAID_MONTHLY_FULL_MARGIN_PERCENT = 75;
export const MIN_PAID_ANNUAL_FULL_MARGIN_PERCENT = 65;

export type PlanCreditAllowance = {
  buildCredits: number;
  actionCredits: number;
};

/** Frozen allowances — do not reduce (P5.4.4). */
export const FIXED_PLAN_CREDITS: Record<
  string,
  { monthlyPriceUsd: number; buildCredits: number; actionCredits: number }
> = {
  free: { monthlyPriceUsd: 0, buildCredits: 20, actionCredits: 20 },
  starter: { monthlyPriceUsd: 20, buildCredits: 150, actionCredits: 400 },
  pro: { monthlyPriceUsd: 50, buildCredits: 375, actionCredits: 1_000 },
  infinity_i: { monthlyPriceUsd: 100, buildCredits: 750, actionCredits: 2_000 },
  infinity_ii: { monthlyPriceUsd: 200, buildCredits: 1_500, actionCredits: 4_000 },
  infinity_iii: { monthlyPriceUsd: 300, buildCredits: 2_250, actionCredits: 6_000 },
  infinity_iv: { monthlyPriceUsd: 380, buildCredits: 2_850, actionCredits: 7_600 },
  infinity_v: { monthlyPriceUsd: 570, buildCredits: 4_250, actionCredits: 11_400 },
  infinity_vi: { monthlyPriceUsd: 855, buildCredits: 6_500, actionCredits: 17_100 },
  infinity_vii: { monthlyPriceUsd: 1_235, buildCredits: 9_300, actionCredits: 25_000 },
};

export const PAID_PLAN_LADDER = [
  { id: "starter", monthlyPriceUsd: 20 },
  { id: "pro", monthlyPriceUsd: 50 },
  { id: "infinity_i", monthlyPriceUsd: 100 },
  { id: "infinity_ii", monthlyPriceUsd: 200 },
  { id: "infinity_iii", monthlyPriceUsd: 300 },
  { id: "infinity_iv", monthlyPriceUsd: 380 },
  { id: "infinity_v", monthlyPriceUsd: 570 },
  { id: "infinity_vi", monthlyPriceUsd: 855 },
  { id: "infinity_vii", monthlyPriceUsd: 1_235 },
] as const;

export function creditPoolCostUsd(buildCredits: number, actionCredits: number): number {
  return (
    buildCredits * BUILD_PROVIDER_USD_PER_CREDIT +
    actionCredits * ACTION_PROVIDER_USD_PER_CREDIT
  );
}

export function paddleFeeUsd(
  monthlyPriceUsd: number,
  feePercent = 0.05,
  feeFixed = 0.5,
): number {
  if (monthlyPriceUsd <= 0) return 0;
  return monthlyPriceUsd * feePercent + feeFixed;
}

export function infraCostUsd(monthlyPriceUsd: number, infraPct = 0.075): number {
  return monthlyPriceUsd * infraPct;
}

export function monthlyCreditMarginPercent(
  monthlyPriceUsd: number,
  buildCredits: number,
  actionCredits: number,
): number {
  if (monthlyPriceUsd <= 0) return 0;
  const cost = creditPoolCostUsd(buildCredits, actionCredits);
  return ((monthlyPriceUsd - cost) / monthlyPriceUsd) * 100;
}

export function annualCreditMarginPercent(
  monthlyListPriceUsd: number,
  buildCredits: number,
  actionCredits: number,
): number {
  const rev = monthlyListPriceUsd * (1 - ANNUAL_BILLING_DISCOUNT);
  if (rev <= 0) return 0;
  const cost = creditPoolCostUsd(buildCredits, actionCredits);
  return ((rev - cost) / rev) * 100;
}

export function monthlyContributionMaxUsageMarginPercent(
  monthlyListPriceUsd: number,
  buildCredits: number,
  actionCredits: number,
  paddlePercent = 0.05,
): number {
  if (monthlyListPriceUsd <= 0) return 0;
  const credit = creditPoolCostUsd(buildCredits, actionCredits);
  const paddleVar = monthlyListPriceUsd * paddlePercent;
  const net = monthlyListPriceUsd - paddleVar;
  if (net <= 0) return 0;
  return ((net - credit) / net) * 100;
}

export function annualContributionMaxUsageMarginPercent(
  monthlyListPriceUsd: number,
  buildCredits: number,
  actionCredits: number,
  paddlePercent = 0.05,
): number {
  const rev = monthlyListPriceUsd * (1 - ANNUAL_BILLING_DISCOUNT);
  if (rev <= 0) return 0;
  const credit = creditPoolCostUsd(buildCredits, actionCredits);
  const paddleVar = rev * paddlePercent;
  const net = rev - paddleVar;
  if (net <= 0) return 0;
  return ((net - credit) / net) * 100;
}

export function monthlyFullMaxUsageMarginPercent(
  monthlyListPriceUsd: number,
  buildCredits: number,
  actionCredits: number,
  opts?: { infraPct?: number; paddlePercent?: number; paddleFixed?: number },
): number {
  if (monthlyListPriceUsd <= 0) return 0;
  const infraPct = opts?.infraPct ?? 0.075;
  const paddlePercent = opts?.paddlePercent ?? 0.05;
  const paddleFixed = opts?.paddleFixed ?? 0.5;
  const cogs =
    creditPoolCostUsd(buildCredits, actionCredits) +
    paddleFeeUsd(monthlyListPriceUsd, paddlePercent, paddleFixed) +
    infraCostUsd(monthlyListPriceUsd, infraPct);
  return ((monthlyListPriceUsd - cogs) / monthlyListPriceUsd) * 100;
}

export function annualFullMaxUsageMarginPercent(
  monthlyListPriceUsd: number,
  buildCredits: number,
  actionCredits: number,
  opts?: { infraPct?: number; paddlePercent?: number; paddleFixed?: number },
): number {
  const rev = monthlyListPriceUsd * (1 - ANNUAL_BILLING_DISCOUNT);
  if (rev <= 0) return 0;
  const infraPct = opts?.infraPct ?? 0.075;
  const paddlePercent = opts?.paddlePercent ?? 0.05;
  const paddleFixed = opts?.paddleFixed ?? 0.5;
  const cogs =
    creditPoolCostUsd(buildCredits, actionCredits) +
    paddleFeeUsd(rev, paddlePercent, paddleFixed) +
    infraCostUsd(rev, infraPct);
  return ((rev - cogs) / rev) * 100;
}

export function creditsForPlanId(planId: string): PlanCreditAllowance {
  const row = FIXED_PLAN_CREDITS[planId];
  if (!row) {
    return { buildCredits: FREE_PLAN_BUILD_CREDITS, actionCredits: FREE_PLAN_ACTION_CREDITS };
  }
  return { buildCredits: row.buildCredits, actionCredits: row.actionCredits };
}

export function creditsFromMonthlyListPrice(monthlyPriceUsd: number): PlanCreditAllowance {
  const match = Object.values(FIXED_PLAN_CREDITS).find(
    (r) => r.monthlyPriceUsd === monthlyPriceUsd,
  );
  if (match) {
    return { buildCredits: match.buildCredits, actionCredits: match.actionCredits };
  }
  if (monthlyPriceUsd <= 0) {
    return { buildCredits: FREE_PLAN_BUILD_CREDITS, actionCredits: FREE_PLAN_ACTION_CREDITS };
  }
  const rawBuild = monthlyPriceUsd * BUILD_CREDITS_PER_DOLLAR;
  const rawAction = monthlyPriceUsd * ACTION_CREDITS_PER_DOLLAR;
  const buildStep = rawBuild >= 500 ? 50 : 25;
  const buildCredits = Math.floor(rawBuild / buildStep) * buildStep || buildStep;
  const actionCredits = Math.round(rawAction / 100) * 100 || 100;
  return { buildCredits, actionCredits };
}

export function assertMonotonicCreditLadder(): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  let prevBc = FREE_PLAN_BUILD_CREDITS;
  let prevAc = FREE_PLAN_ACTION_CREDITS;
  for (const { id } of PAID_PLAN_LADDER) {
    const a = creditsForPlanId(id);
    if (a.buildCredits < prevBc) {
      failures.push(`${id} BC ${a.buildCredits} < previous ${prevBc}`);
    }
    if (a.actionCredits < prevAc) {
      failures.push(`${id} AC ${a.actionCredits} < previous ${prevAc}`);
    }
    prevBc = a.buildCredits;
    prevAc = a.actionCredits;
  }
  return { ok: failures.length === 0, failures };
}
