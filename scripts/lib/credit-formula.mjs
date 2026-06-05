/**
 * P5.4.4 credit formula — JS mirror of src/lib/billing/credit-formula.ts
 */

export const BUILD_CREDITS_PER_DOLLAR = 7.5;
export const ACTION_CREDITS_PER_DOLLAR = 20;
export const FREE_PLAN_BUILD_CREDITS = 20;
export const FREE_PLAN_ACTION_CREDITS = 20;
export const BUILD_PROVIDER_USD_PER_CREDIT = 0.02;
export const ACTION_PROVIDER_USD_PER_CREDIT = 0.003;
export const P544_FROZEN_CREDIT_LADDER = true;
export const MIN_MONTHLY_CREDIT_MARGIN_PERCENT = 75;
export const MIN_ANNUAL_CREDIT_MARGIN_PERCENT = 65;
export const STARTER_MIN_MONTHLY_FULL_MARGIN_PERCENT = 77;
export const STARTER_MIN_ANNUAL_FULL_MARGIN_PERCENT = 68;
export const MIN_PAID_MONTHLY_FULL_MARGIN_PERCENT = 75;
export const MIN_PAID_ANNUAL_FULL_MARGIN_PERCENT = 65;
export const ANNUAL_BILLING_DISCOUNT = 0.2;

export const FIXED_PLAN_CREDITS = {
  free: { monthlyPriceUsd: 0, buildCredits: 20, actionCredits: 20 },
  starter: { monthlyPriceUsd: 20, buildCredits: 150, actionCredits: 400 },
  pro: { monthlyPriceUsd: 50, buildCredits: 375, actionCredits: 1000 },
  infinity_i: { monthlyPriceUsd: 100, buildCredits: 750, actionCredits: 2000 },
  infinity_ii: { monthlyPriceUsd: 200, buildCredits: 1500, actionCredits: 4000 },
  infinity_iii: { monthlyPriceUsd: 300, buildCredits: 2250, actionCredits: 6000 },
  infinity_iv: { monthlyPriceUsd: 380, buildCredits: 2850, actionCredits: 7600 },
  infinity_v: { monthlyPriceUsd: 570, buildCredits: 4250, actionCredits: 11400 },
  infinity_vi: { monthlyPriceUsd: 855, buildCredits: 6500, actionCredits: 17100 },
  infinity_vii: { monthlyPriceUsd: 1235, buildCredits: 9300, actionCredits: 25000 },
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
  { id: "infinity_vii", monthlyPriceUsd: 1235 },
];

export function creditPoolCostUsd(buildCredits, actionCredits) {
  return buildCredits * BUILD_PROVIDER_USD_PER_CREDIT + actionCredits * ACTION_PROVIDER_USD_PER_CREDIT;
}

export function paddleFeeUsd(monthlyPriceUsd, feePercent = 0.05, feeFixed = 0.5) {
  if (monthlyPriceUsd <= 0) return 0;
  return monthlyPriceUsd * feePercent + feeFixed;
}

export function infraCostUsd(monthlyPriceUsd, infraPct = 0.075) {
  return monthlyPriceUsd * infraPct;
}

export function monthlyCreditMarginPercent(monthlyPriceUsd, buildCredits, actionCredits) {
  if (monthlyPriceUsd <= 0) return 0;
  const cost = creditPoolCostUsd(buildCredits, actionCredits);
  return ((monthlyPriceUsd - cost) / monthlyPriceUsd) * 100;
}

export function annualCreditMarginPercent(monthlyListPriceUsd, buildCredits, actionCredits) {
  const rev = monthlyListPriceUsd * (1 - ANNUAL_BILLING_DISCOUNT);
  if (rev <= 0) return 0;
  const cost = creditPoolCostUsd(buildCredits, actionCredits);
  return ((rev - cost) / rev) * 100;
}

export function monthlyContributionMaxUsageMarginPercent(price, bc, ac, paddlePercent = 0.05) {
  if (price <= 0) return 0;
  const credit = creditPoolCostUsd(bc, ac);
  const paddleVar = price * paddlePercent;
  const net = price - paddleVar;
  if (net <= 0) return 0;
  return ((net - credit) / net) * 100;
}

export function annualContributionMaxUsageMarginPercent(listPrice, bc, ac, paddlePercent = 0.05) {
  const rev = listPrice * (1 - ANNUAL_BILLING_DISCOUNT);
  if (rev <= 0) return 0;
  const credit = creditPoolCostUsd(bc, ac);
  const paddleVar = rev * paddlePercent;
  const net = rev - paddleVar;
  if (net <= 0) return 0;
  return ((net - credit) / net) * 100;
}

export function monthlyFullMaxUsageMarginPercent(price, bc, ac, opts = {}) {
  if (price <= 0) return 0;
  const infraPct = opts.infraPct ?? 0.075;
  const paddlePercent = opts.paddlePercent ?? 0.05;
  const paddleFixed = opts.paddleFixed ?? 0.5;
  const cogs =
    creditPoolCostUsd(bc, ac) +
    paddleFeeUsd(price, paddlePercent, paddleFixed) +
    infraCostUsd(price, infraPct);
  return ((price - cogs) / price) * 100;
}

export function annualFullMaxUsageMarginPercent(listPrice, bc, ac, opts = {}) {
  const rev = listPrice * (1 - ANNUAL_BILLING_DISCOUNT);
  if (rev <= 0) return 0;
  const infraPct = opts.infraPct ?? 0.075;
  const paddlePercent = opts.paddlePercent ?? 0.05;
  const paddleFixed = opts.paddleFixed ?? 0.5;
  const cogs =
    creditPoolCostUsd(bc, ac) +
    paddleFeeUsd(rev, paddlePercent, paddleFixed) +
    infraCostUsd(rev, infraPct);
  return ((rev - cogs) / rev) * 100;
}

export function creditsForPlanId(planId) {
  const row = FIXED_PLAN_CREDITS[planId];
  if (!row) return { buildCredits: FREE_PLAN_BUILD_CREDITS, actionCredits: FREE_PLAN_ACTION_CREDITS };
  return { buildCredits: row.buildCredits, actionCredits: row.actionCredits };
}

export function creditsFromMonthlyListPrice(monthlyPriceUsd) {
  const match = Object.values(FIXED_PLAN_CREDITS).find((r) => r.monthlyPriceUsd === monthlyPriceUsd);
  if (match) return { buildCredits: match.buildCredits, actionCredits: match.actionCredits };
  if (monthlyPriceUsd <= 0) return { buildCredits: FREE_PLAN_BUILD_CREDITS, actionCredits: FREE_PLAN_ACTION_CREDITS };
  const rawBuild = monthlyPriceUsd * BUILD_CREDITS_PER_DOLLAR;
  const rawAction = monthlyPriceUsd * ACTION_CREDITS_PER_DOLLAR;
  const buildStep = rawBuild >= 500 ? 50 : 25;
  const buildCredits = Math.floor(rawBuild / buildStep) * buildStep || buildStep;
  const actionCredits = Math.round(rawAction / 100) * 100 || 100;
  return { buildCredits, actionCredits };
}

export function planAllowancesFromLadder() {
  const rows = [{ id: "free", ...FIXED_PLAN_CREDITS.free }];
  for (const p of PAID_PLAN_LADDER) {
    const c = creditsForPlanId(p.id);
    rows.push({ id: p.id, monthlyPriceUsd: p.monthlyPriceUsd, ...c });
  }
  return rows;
}

export function assertMonotonicLadder(rows) {
  const failures = [];
  const paid = rows.filter((r) => r.id !== "free").sort((a, b) => a.monthlyPriceUsd - b.monthlyPriceUsd);
  let prevBc = FREE_PLAN_BUILD_CREDITS;
  let prevAc = FREE_PLAN_ACTION_CREDITS;
  for (const row of paid) {
    if (row.buildCredits < prevBc) failures.push(`${row.id} BC ${row.buildCredits} < ${prevBc}`);
    if (row.actionCredits < prevAc) failures.push(`${row.id} AC ${row.actionCredits} < ${prevAc}`);
    prevBc = row.buildCredits;
    prevAc = row.actionCredits;
  }
  return failures;
}

export function paddleFee(priceUsd, pct = 0.05, fixed = 0.5) {
  if (priceUsd <= 0) return 0;
  return priceUsd * pct + fixed;
}
