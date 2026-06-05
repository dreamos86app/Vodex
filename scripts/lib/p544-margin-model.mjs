/**
 * P5.4.4 — platform margin simulation (current vs optimized economy).
 */
import {
  ACTION_CATALOG,
  ACTION_CATALOG_BASELINE,
  auditActionRow,
  STARTER_ACTION_REVENUE_USD,
} from "./action-cost-audit.mjs";
import {
  DEFAULT_FORECAST_ASSUMPTIONS,
  monthlyPlatformForecast,
  planRows,
} from "./profit-forecast-model.mjs";
import {
  FIXED_PLAN_CREDITS,
  PAID_PLAN_LADDER,
  P544_FROZEN_CREDIT_LADDER,
  creditsForPlanId,
  creditPoolCostUsd,
  monthlyFullMaxUsageMarginPercent,
} from "./credit-formula.mjs";
import { blendedMonthlyEconomics, DEFAULT_ASSUMPTIONS } from "./unit-economics-model.mjs";

/** Weighted monthly action mix per paid user (fraction of users running action). */
const PAID_ACTION_MIX = [
  { id: "discuss_message", weight: 40 },
  { id: "generate_app_simple", weight: 0.35 },
  { id: "generate_app_medium", weight: 0.2 },
  { id: "generate_app_complex", weight: 0.08 },
  { id: "edit_app_medium", weight: 1.2 },
  { id: "zip_preview_tier2", weight: 0.15 },
  { id: "zip_preview_tier4", weight: 0.04 },
  { id: "android_apk", weight: 0.05 },
  { id: "android_aab", weight: 0.03 },
  { id: "image_premium", weight: 0.1 },
  { id: "runtime_llm_small", weight: 2.5 },
  { id: "email_send", weight: 1.5 },
];

function catalogById(catalog) {
  return Object.fromEntries(catalog.map((r) => [r.id, r]));
}

function weightedActionCogsPerUser(catalog, utilizationScale = 1) {
  const map = catalogById(catalog);
  let cogs = 0;
  for (const { id, weight } of PAID_ACTION_MIX) {
    const row = map[id];
    if (!row) continue;
    const audited = auditActionRow(row, STARTER_ACTION_REVENUE_USD);
    cogs += audited.totalCost * weight * utilizationScale;
  }
  return cogs;
}

function avgStarterFullGross() {
  const s = creditsForPlanId("starter");
  return monthlyFullMaxUsageMarginPercent(20, s.buildCredits, s.actionCredits);
}

export function actionOptimizationTable() {
  const base = catalogById(ACTION_CATALOG_BASELINE);
  return ACTION_CATALOG.map((opt) => {
    const b = base[opt.id];
    const bo = b ? auditActionRow(b) : null;
    const oo = auditActionRow(opt);
    return {
      action: opt.id,
      currentCost: bo?.totalCost ?? 0,
      providerCost: opt.providerUsd,
      currentCredits: b?.creditCost ?? opt.creditCost,
      currentMargin: bo?.marginPct ?? 0,
      suggestedCredits: opt.creditCost,
      newMargin: oo.marginPct,
      savingsPerUse: (bo?.totalCost ?? oo.totalCost) - oo.totalCost,
    };
  });
}

export function providerSavingsTable() {
  const base = catalogById(ACTION_CATALOG_BASELINE);
  const rows = [];
  for (const opt of ACTION_CATALOG) {
    const b = base[opt.id];
    if (!b) continue;
    const provSave = b.providerUsd - opt.providerUsd;
    const infraSave = b.infraUsd - opt.infraUsd;
    if (provSave + infraSave <= 0.0001 && opt.creditCost <= b.creditCost) continue;
    rows.push({
      action: opt.id,
      providerBefore: b.providerUsd,
      providerAfter: opt.providerUsd,
      infraBefore: b.infraUsd,
      infraAfter: opt.infraUsd,
      creditsBefore: b.creditCost,
      creditsAfter: opt.creditCost,
      pctProviderSave: b.providerUsd > 0 ? (provSave / b.providerUsd) * 100 : 0,
    });
  }
  return rows.sort((a, b) => b.pctProviderSave - a.pctProviderSave);
}

export function simulatePaidUsers(paidUsers, assumptions = DEFAULT_FORECAST_ASSUMPTIONS) {
  const planMix = assumptions.planMix;
  let mrr = 0;
  for (const [plan, share] of Object.entries(planMix)) {
    const ladder = PAID_PLAN_LADDER.find((p) => p.id === plan);
    if (!ladder) continue;
    mrr += paidUsers * share * ladder.monthlyPriceUsd;
  }

  const util = assumptions.paidCreditUtilization;
  let creditPoolCogs = 0;
  for (const [plan, share] of Object.entries(planMix)) {
    const users = paidUsers * share;
    const { buildCredits, actionCredits } = creditsForPlanId(plan);
    creditPoolCogs += users * creditPoolCostUsd(buildCredits, actionCredits) * util;
  }

  const baselineExtra = weightedActionCogsPerUser(ACTION_CATALOG_BASELINE, paidUsers * 0.02);
  const optimizedExtra = weightedActionCogsPerUser(ACTION_CATALOG, paidUsers * 0.018);

  const paddle = mrr * assumptions.paddleFeePercent + paidUsers * assumptions.paddleFeeFixedUsd;
  const infra = mrr * assumptions.infraOverheadPct;
  const freeCogs = assumptions.freeActiveCreditUsers * 0.13;

  const currentCogs = creditPoolCogs + baselineExtra + paddle + infra + freeCogs;
  const optimizedCogs = creditPoolCogs * 0.94 + optimizedExtra + paddle + infra * 0.97 + freeCogs;

  return {
    paidUsers,
    mrr,
    current: {
      cogs: currentCogs,
      grossProfit: mrr - currentCogs,
      margin: mrr > 0 ? ((mrr - currentCogs) / mrr) * 100 : 0,
    },
    optimized: {
      cogs: optimizedCogs,
      grossProfit: mrr - optimizedCogs,
      margin: mrr > 0 ? ((mrr - optimizedCogs) / mrr) * 100 : 0,
    },
    delta: {
      cogs: currentCogs - optimizedCogs,
      grossProfit: (mrr - optimizedCogs) - (mrr - currentCogs),
      marginPts: mrr > 0 ? ((mrr - optimizedCogs) / mrr) * 100 - ((mrr - currentCogs) / mrr) * 100 : 0,
    },
  };
}

export function p544Summary() {
  const platform = monthlyPlatformForecast(DEFAULT_FORECAST_ASSUMPTIONS);
  const blended = blendedMonthlyEconomics(DEFAULT_ASSUMPTIONS);
  const starterFull = avgStarterFullGross();
  const sim1k = simulatePaidUsers(1000);
  const sim5k = simulatePaidUsers(5000);
  const sim10k = simulatePaidUsers(10000);
  const sim25k = simulatePaidUsers(25000);

  return {
    frozenLadder: P544_FROZEN_CREDIT_LADDER,
    starter: FIXED_PLAN_CREDITS.starter,
    starterFullGrossMaxBurnPct: starterFull,
    blendedPlatformMarginPct: platform.marginPct,
    unitEconomicsBlendedPct: blended.grossMargin,
    monthlyProfitDelta1k: sim1k.delta.grossProfit,
    annualProfitDelta1k: sim1k.delta.grossProfit * 12,
    simulations: { sim1k, sim5k, sim10k, sim25k },
    actionTable: actionOptimizationTable(),
    providerSavings: providerSavingsTable(),
    planRows: planRows(),
  };
}
