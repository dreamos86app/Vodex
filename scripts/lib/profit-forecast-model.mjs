/**
 * P5.4.4 profit forecast — frozen ladder; blended margin gate + informational full gross.
 */
import { discussMessageCostUsd } from "./unit-economics-model.mjs";
import {
  ACTION_PROVIDER_USD_PER_CREDIT,
  ANNUAL_BILLING_DISCOUNT,
  BUILD_PROVIDER_USD_PER_CREDIT,
  FREE_PLAN_ACTION_CREDITS,
  FREE_PLAN_BUILD_CREDITS,
  MIN_ANNUAL_CREDIT_MARGIN_PERCENT,
  MIN_MONTHLY_CREDIT_MARGIN_PERCENT,
  MIN_PAID_ANNUAL_FULL_MARGIN_PERCENT,
  MIN_PAID_MONTHLY_FULL_MARGIN_PERCENT,
  PAID_PLAN_LADDER,
  P544_FROZEN_CREDIT_LADDER,
  STARTER_MIN_ANNUAL_FULL_MARGIN_PERCENT,
  STARTER_MIN_MONTHLY_FULL_MARGIN_PERCENT,
  annualContributionMaxUsageMarginPercent,
  annualCreditMarginPercent,
  annualFullMaxUsageMarginPercent,
  creditPoolCostUsd,
  creditsForPlanId,
  infraCostUsd,
  monthlyContributionMaxUsageMarginPercent,
  monthlyCreditMarginPercent,
  monthlyFullMaxUsageMarginPercent,
  paddleFee,
  paddleFeeUsd,
  planAllowancesFromLadder,
} from "./credit-formula.mjs";

export const DEFAULT_FORECAST_ASSUMPTIONS = {
  paddleFeePercent: 0.05,
  paddleFeeFixedUsd: 0.5,
  annualDiscount: ANNUAL_BILLING_DISCOUNT,
  infraOverheadPct: 0.075,
  targetBlendedMarginPercent: 80,
  buildCostCeilingUsd: BUILD_PROVIDER_USD_PER_CREDIT,
  actionCostCeilingUsd: ACTION_PROVIDER_USD_PER_CREDIT,
  freeActiveCreditUsers: 620,
  freeUtilization: 0.28,
  freeDiscussTurnsPerMonth: 12,
  monthlySignups: 3900,
  paidConversionsPerMonth: 500,
  monthlyChurnPct: 0.06,
  monthlyAnnualSplit: { monthly: 0.65, annual: 0.35 },
  planMix: {
    starter: 0.45,
    pro: 0.3,
    infinity_i: 0.12,
    infinity_ii: 0.06,
    infinity_iii: 0.03,
    infinity_iv: 0.02,
    infinity_v: 0.01,
    infinity_vi: 0.007,
    infinity_vii: 0.003,
  },
  paidCreditUtilization: 0.284,
  starterUserCount: 1000,
  proUserCount: null,
};

export function planRows(assumptions = DEFAULT_FORECAST_ASSUMPTIONS) {
  return planAllowancesFromLadder().map((row) => {
    const annualMonthlyRev = row.monthlyPriceUsd * (1 - assumptions.annualDiscount);
    const buildCost = row.buildCredits * assumptions.buildCostCeilingUsd;
    const actionCost = row.actionCredits * assumptions.actionCostCeilingUsd;
    const creditCost = buildCost + actionCost;
    const paddle = paddleFeeUsd(row.monthlyPriceUsd, assumptions.paddleFeePercent, assumptions.paddleFeeFixedUsd);
    const infra = infraCostUsd(row.monthlyPriceUsd, assumptions.infraOverheadPct);
    const fullMonthly = monthlyFullMaxUsageMarginPercent(row.monthlyPriceUsd, row.buildCredits, row.actionCredits, {
      infraPct: assumptions.infraOverheadPct,
      paddlePercent: assumptions.paddleFeePercent,
      paddleFixed: assumptions.paddleFeeFixedUsd,
    });
    const fullAnnual = annualFullMaxUsageMarginPercent(row.monthlyPriceUsd, row.buildCredits, row.actionCredits, {
      infraPct: assumptions.infraOverheadPct,
      paddlePercent: assumptions.paddleFeePercent,
      paddleFixed: assumptions.paddleFeeFixedUsd,
    });
    const contribMonthly = monthlyContributionMaxUsageMarginPercent(
      row.monthlyPriceUsd,
      row.buildCredits,
      row.actionCredits,
      assumptions.paddleFeePercent,
    );
    const contribAnnual = annualContributionMaxUsageMarginPercent(
      row.monthlyPriceUsd,
      row.buildCredits,
      row.actionCredits,
      assumptions.paddleFeePercent,
    );
    const creditMonthly = monthlyCreditMarginPercent(row.monthlyPriceUsd, row.buildCredits, row.actionCredits);
    const creditAnnual = annualCreditMarginPercent(row.monthlyPriceUsd, row.buildCredits, row.actionCredits);
    return {
      ...row,
      annualMonthlyRev,
      buildCost,
      actionCost,
      creditCost,
      paddle,
      infra,
      monthlyTotalCogs: creditCost + paddle + infra,
      monthlyGrossProfit: row.monthlyPriceUsd - (creditCost + paddle + infra),
      monthlyFullMarginPct: fullMonthly,
      annualFullMarginPct: fullAnnual,
      monthlyContributionMarginPct: contribMonthly,
      annualContributionMarginPct: contribAnnual,
      monthlyCreditMargin: creditMonthly,
      annualCreditMargin: creditAnnual,
      bcPerDollar: row.monthlyPriceUsd > 0 ? row.buildCredits / row.monthlyPriceUsd : 0,
      acPerDollar: row.monthlyPriceUsd > 0 ? row.actionCredits / row.monthlyPriceUsd : 0,
    };
  });
}

export function freeUserExposure(assumptions = DEFAULT_FORECAST_ASSUMPTIONS) {
  const discussCost = discussMessageCostUsd();
  const worstCredit =
    creditPoolCostUsd(FREE_PLAN_BUILD_CREDITS, FREE_PLAN_ACTION_CREDITS) +
    assumptions.freeDiscussTurnsPerMonth * discussCost;
  const realisticCredit =
    creditPoolCostUsd(FREE_PLAN_BUILD_CREDITS, FREE_PLAN_ACTION_CREDITS) * assumptions.freeUtilization +
    assumptions.freeDiscussTurnsPerMonth * discussCost * assumptions.freeUtilization;
  return {
    freeUsers: assumptions.freeActiveCreditUsers,
    utilization: assumptions.freeUtilization,
    worstCaseCogs: worstCredit,
    realisticCogs: realisticCredit,
    discussCogs: assumptions.freeDiscussTurnsPerMonth * discussCost * assumptions.freeUtilization,
    totalRealisticCogs: realisticCredit,
  };
}

export function scenarioForecast(assumptions, overrides = {}) {
  const a = { ...assumptions, ...overrides };
  const users = a.paidUsers ?? a.starterUserCount ?? 500;
  const util = a.paidCreditUtilization ?? 1;
  let mrr = 0;
  let cogs = 0;
  const planMix = a.planMix ?? { starter: 1 };
  for (const [plan, share] of Object.entries(planMix)) {
    const ladder = PAID_PLAN_LADDER.find((p) => p.id === plan);
    if (!ladder) continue;
    const count = users * share;
    const { buildCredits, actionCredits } = creditsForPlanId(plan);
    const price = ladder.monthlyPriceUsd;
    const isAnnual = a.billingInterval === "annual";
    const revPerUser = isAnnual ? price * (1 - a.annualDiscount) : price;
    mrr += count * revPerUser;
    const creditBurn = creditPoolCostUsd(buildCredits, actionCredits) * util * count;
    const paddlePerUser = paddleFee(revPerUser, a.paddleFeePercent, a.paddleFeeFixedUsd);
    const infraPerUser = revPerUser * a.infraOverheadPct;
    cogs += creditBurn + paddlePerUser * count + infraPerUser * count;
  }
  if (a.includeFreeExposure !== false && !a.paidOnly) {
    cogs += freeUserExposure(a).totalRealisticCogs * (a.freeUserMultiplier ?? 1);
  }
  const grossProfit = mrr - cogs;
  const marginPct = mrr > 0 ? (grossProfit / mrr) * 100 : 0;
  const pass = marginPct >= (a.targetBlendedMarginPercent ?? 80) - 0.5;
  return { revenue: mrr, cogs, grossProfit, marginPct, pass, assumptions: a };
}

export function monthlyPlatformForecast(assumptions = DEFAULT_FORECAST_ASSUMPTIONS, paidUsers = null) {
  const activePaid = paidUsers ?? assumptions.paidConversionsPerMonth;
  let mrr = 0;
  let cogs = 0;
  const byPlan = {};
  for (const [plan, share] of Object.entries(assumptions.planMix)) {
    const users = activePaid * share;
    const ladder = PAID_PLAN_LADDER.find((p) => p.id === plan);
    if (!ladder) continue;
    const { buildCredits, actionCredits } = creditsForPlanId(plan);
    const price = ladder.monthlyPriceUsd;
    const rev = users * price;
    const creditBurn =
      creditPoolCostUsd(buildCredits, actionCredits) * assumptions.paidCreditUtilization * users;
    const fees = paddleFee(price, assumptions.paddleFeePercent, assumptions.paddleFeeFixedUsd) * users;
    const infra = price * assumptions.infraOverheadPct * users;
    const planCogs = creditBurn + fees + infra;
    mrr += rev;
    cogs += planCogs;
    byPlan[plan] = { users, revenue: rev, cogs: planCogs, grossProfit: rev - planCogs };
  }
  const free = freeUserExposure(assumptions);
  cogs += free.totalRealisticCogs;
  const grossProfit = mrr - cogs;
  return { mrr, cogs, grossProfit, marginPct: mrr > 0 ? (grossProfit / mrr) * 100 : 0, byPlan, free };
}

export function runMonthForecast(assumptions, months) {
  const results = [];
  let activePaid = 0;
  let activeFree = 0;
  for (let month = 1; month <= months; month++) {
    const churned = activePaid * assumptions.monthlyChurnPct;
    activePaid = activePaid - churned + assumptions.paidConversionsPerMonth;
    activeFree += assumptions.monthlySignups - assumptions.paidConversionsPerMonth;
    const base = monthlyPlatformForecast(assumptions, assumptions.paidConversionsPerMonth);
    const scale = activePaid / assumptions.paidConversionsPerMonth;
    const mrr = base.mrr * scale;
    const cogs = base.cogs * scale;
    const grossProfit = mrr - cogs;
    results.push({
      month,
      newSignups: assumptions.monthlySignups,
      activeFreeUsers: Math.round(activeFree),
      newPaidUsers: assumptions.paidConversionsPerMonth,
      churnedPaidUsers: Math.round(churned),
      totalPaidUsers: Math.round(activePaid),
      mrr,
      cogs,
      grossProfit,
      marginPct: mrr > 0 ? (grossProfit / mrr) * 100 : 0,
    });
  }
  return results;
}

export function stressScenarios(assumptions = DEFAULT_FORECAST_ASSUMPTIONS) {
  const scenarios = [];
  const add = (id, label, overrides, reason) => {
    const r = scenarioForecast(assumptions, overrides);
    scenarios.push({
      id,
      label,
      revenue: r.revenue,
      cogs: r.cogs,
      grossProfit: r.grossProfit,
      marginPct: r.marginPct,
      pass: r.pass,
      reason: reason ?? (r.pass ? "meets blended target" : `margin ${r.marginPct.toFixed(1)}% below target`),
    });
  };
  add("A", "1,000 Starter monthly max usage", {
    planMix: { starter: 1 },
    starterUserCount: 1000,
    paidUsers: 1000,
    paidCreditUtilization: 1,
    paidOnly: true,
    includeFreeExposure: false,
  });
  add("B", "1,000 Starter annual max usage", {
    planMix: { starter: 1 },
    starterUserCount: 1000,
    paidUsers: 1000,
    paidCreditUtilization: 1,
    billingInterval: "annual",
    paidOnly: true,
    includeFreeExposure: false,
  });
  add("C", "1,000 Starter monthly normal usage", {
    planMix: { starter: 1 },
    starterUserCount: 1000,
    paidUsers: 1000,
    paidCreditUtilization: assumptions.paidCreditUtilization,
    paidOnly: true,
    includeFreeExposure: false,
  });
  add("D", "1,000 Starter annual normal usage", {
    planMix: { starter: 1 },
    starterUserCount: 1000,
    paidUsers: 1000,
    paidCreditUtilization: assumptions.paidCreditUtilization,
    billingInterval: "annual",
    paidOnly: true,
    includeFreeExposure: false,
  });
  add("E", "Mixed paid default split", { paidUsers: 500, paidCreditUtilization: assumptions.paidCreditUtilization });
  add("F", "All paid Starter", { planMix: { starter: 1 }, paidUsers: 500, paidCreditUtilization: assumptions.paidCreditUtilization });
  add("G", "All paid annual Starter", {
    planMix: { starter: 1 },
    paidUsers: 500,
    billingInterval: "annual",
    paidCreditUtilization: assumptions.paidCreditUtilization,
  });
  add("H", "2x free user spike", { freeUserMultiplier: 2 });
  add("I", "Heavy Action Credit usage", { paidCreditUtilization: 0.55 });
  add("J", "Heavy Build Credit usage", { paidCreditUtilization: 0.5 });
  return scenarios;
}

export function forecastPassFail(assumptions = DEFAULT_FORECAST_ASSUMPTIONS) {
  const plans = planRows(assumptions);
  const failures = [];
  const starter = plans.find((p) => p.id === "starter");
  if (!P544_FROZEN_CREDIT_LADDER) {
    if (starter) {
      if (starter.monthlyFullMarginPct < STARTER_MIN_MONTHLY_FULL_MARGIN_PERCENT - 0.1) {
        failures.push(
          `starter monthly full gross ${starter.monthlyFullMarginPct.toFixed(1)}% < ${STARTER_MIN_MONTHLY_FULL_MARGIN_PERCENT}%`,
        );
      }
      if (starter.annualFullMarginPct < STARTER_MIN_ANNUAL_FULL_MARGIN_PERCENT - 0.1) {
        failures.push(
          `starter annual full gross ${starter.annualFullMarginPct.toFixed(1)}% < ${STARTER_MIN_ANNUAL_FULL_MARGIN_PERCENT}%`,
        );
      }
    }
    for (const p of plans.filter((x) => x.monthlyPriceUsd > 0 && x.id !== "starter")) {
      if (p.monthlyFullMarginPct < MIN_PAID_MONTHLY_FULL_MARGIN_PERCENT - 0.1) {
        failures.push(
          `${p.id} monthly full gross ${p.monthlyFullMarginPct.toFixed(1)}% < ${MIN_PAID_MONTHLY_FULL_MARGIN_PERCENT}%`,
        );
      }
      if (p.annualFullMarginPct < MIN_PAID_ANNUAL_FULL_MARGIN_PERCENT - 0.1) {
        failures.push(
          `${p.id} annual full gross ${p.annualFullMarginPct.toFixed(1)}% < ${MIN_PAID_ANNUAL_FULL_MARGIN_PERCENT}%`,
        );
      }
      if (p.monthlyCreditMargin < MIN_MONTHLY_CREDIT_MARGIN_PERCENT - 0.1) {
        failures.push(`${p.id} credit margin ${p.monthlyCreditMargin.toFixed(1)}%`);
      }
    }
  }
  const mono = assertMonotonicFromPlans(plans);
  failures.push(...mono);
  const blended = monthlyPlatformForecast(assumptions);
  if (Math.round(blended.marginPct * 10) / 10 < assumptions.targetBlendedMarginPercent) {
    failures.push(`blended ${blended.marginPct.toFixed(1)}% < ${assumptions.targetBlendedMarginPercent}%`);
  }
  return { ok: failures.length === 0, failures, plans, blended, starter };
}

function assertMonotonicFromPlans(plans) {
  const paid = plans.filter((p) => p.monthlyPriceUsd > 0).sort((a, b) => a.monthlyPriceUsd - b.monthlyPriceUsd);
  const failures = [];
  for (let i = 1; i < paid.length; i++) {
    if (paid[i].buildCredits < paid[i - 1].buildCredits) failures.push(`${paid[i].id} BC drops`);
    if (paid[i].actionCredits < paid[i - 1].actionCredits) failures.push(`${paid[i].id} AC drops`);
  }
  return failures;
}
