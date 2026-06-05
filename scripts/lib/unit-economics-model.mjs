/**
 * Vodex unit economics — shared model for audit + P5.4.1 verification.
 * Allowances derived from credit-formula (7.5 BC/$ + 25 AC/$).
 */
import {
  creditsForPlanId,
  FIXED_PLAN_CREDITS,
  MIN_MONTHLY_CREDIT_MARGIN_PERCENT,
  PAID_PLAN_LADDER,
} from "./credit-formula.mjs";

export const TARGET_GROSS_MARGIN_PERCENT = 80;
export const MIN_MAX_BURN_MARGIN_PERCENT = MIN_MONTHLY_CREDIT_MARGIN_PERCENT;
export const MIN_ACTION_MARGIN_MULTIPLIER = 5;
export const MIN_BUILD_MARGIN_MULTIPLIER = 5;

/** Baseline revenue per Action Credit (Starter $20 / allowance). */
export function actionRevenueUsdPerCredit(starterPrice, starterActionCredits) {
  return starterPrice / starterActionCredits;
}

export const DEFAULT_ASSUMPTIONS = {
  targetGrossMarginPercent: TARGET_GROSS_MARGIN_PERCENT,
  minActionMarginMultiplier: MIN_ACTION_MARGIN_MULTIPLIER,
  minBuildMarginMultiplier: MIN_BUILD_MARGIN_MULTIPLIER,

  newUsersPerMonth: 3900,
  paidConversionsPerMonth: 500,
  churnMonthlyPct: 0.06,
  /** Lean shared infra at current scale (Vercel + Supabase + workers); revisit at 10k+ MAU. */
  infraCostPctOfRevenue: 0.075,
  paymentFeePct: 0.05,
  paymentFeeFixedUsd: 0.5,

  planMix: {
    starter: 0.35,
    pro: 0.4,
    infinity_i: 0.15,
    infinity_ii: 0.06,
    infinity_iii: 0.04,
  },

  planPriceUsd: {
    free: 0,
    starter: 20,
    pro: 50,
    infinity_i: 100,
    infinity_ii: 200,
    infinity_iii: 300,
    infinity_iv: 380,
    infinity_v: 570,
    infinity_vi: 855,
    infinity_vii: 1235,
  },

  /** P5.3 allowances (before P5.4 repricing) */
  currentBuildCreditsByPlan: {
    free: 20,
    starter: 185,
    pro: 475,
    infinity_i: 975,
    infinity_ii: 1950,
    infinity_iii: 2900,
  },
  currentActionCreditsByPlan: {
    free: 20,
    starter: 420,
    pro: 1125,
    infinity_i: 2350,
    infinity_ii: 4700,
    infinity_iii: 7000,
  },

  /** P5.4.1 — populated from credit-formula below */
  buildCreditsByPlan: {},
  actionCreditsByPlan: {},

  /** Max provider USD per credit when allowance fully utilized */
  providerUsdPerBuildCredit: 0.02,
  providerUsdPerActionCredit: 0.003,

  /**
   * Utilization — realistic burn vs max allowance.
   * Not all signups become heavy users; only a subset burns credits in month 1.
   */
  /** ~23% of non-paid signups with metered usage in month 1 (industry-typical activation). */
  /** ~20% of non-paid signups with metered usage in month 1. */
  freeActiveCreditUsersPerMonth: 620,
  freeCreditUtilization: 0.28,
  /**
   * Paid subscribers — effective allowance utilization after P5.4 heavy-action repricing
   * (same workflows burn fewer pool units because ZIP/mobile/premium cost more AC each).
   */
  paidCreditUtilization: 0.284,
  freeDiscussTurnsPerMonth: 12,

  /** Discuss — gpt-4o-mini medium turn (800 in / 600 out) */
  discussModelId: "gpt-4o-mini",
  discussInputTokens: 800,
  discussOutputTokens: 600,
  discussModelCostPer1M: { in: 0.15, out: 0.6 },

  /** Per-action provider USD estimates */
  actionCostsUsd: {
    zipPreviewTier2: 0.072,
    zipPreviewTier4: 0.38,
    androidBuild: 0.1,
    iosBuild: 0.16,
    logoGeneration: 0.045,
    imageStandard: 0.036,
    runtimeLlmSmall: 0.007,
    runtimeEmail: 0.002,
  },

  /** Extra paid-user COGS beyond credit pools (preview/build frequency) */
  paidZipPreviewRate: 0.15,
  paidAndroidBuildRate: 0.05,

  /** Build credit list revenue (10 BC = $1) */
  userCreditsPerUsd: 10,
};

{
  const free = FIXED_PLAN_CREDITS.free;
  DEFAULT_ASSUMPTIONS.buildCreditsByPlan.free = free.buildCredits;
  DEFAULT_ASSUMPTIONS.actionCreditsByPlan.free = free.actionCredits;
  for (const p of PAID_PLAN_LADDER) {
    const c = creditsForPlanId(p.id);
    DEFAULT_ASSUMPTIONS.buildCreditsByPlan[p.id] = c.buildCredits;
    DEFAULT_ASSUMPTIONS.actionCreditsByPlan[p.id] = c.actionCredits;
    DEFAULT_ASSUMPTIONS.planPriceUsd[p.id] = p.monthlyPriceUsd;
  }
}

export function discussMessageCostUsd(assumptions = DEFAULT_ASSUMPTIONS) {
  const { discussInputTokens, discussOutputTokens, discussModelCostPer1M } = assumptions;
  return (
    (discussInputTokens / 1_000_000) * discussModelCostPer1M.in +
    (discussOutputTokens / 1_000_000) * discussModelCostPer1M.out
  );
}

export function discussMarginAtBc(bc, providerCostUsd, userCreditsPerUsd = 10) {
  const revenueUsd = bc / userCreditsPerUsd;
  if (providerCostUsd <= 0) return Infinity;
  return revenueUsd / providerCostUsd;
}

export function recommendDiscussBc(providerCostUsd, assumptions = DEFAULT_ASSUMPTIONS) {
  const minMult = assumptions.minBuildMarginMultiplier;
  const at03 = discussMarginAtBc(0.3, providerCostUsd, assumptions.userCreditsPerUsd);
  if (at03 >= minMult) return { credits: 0.3, margin: at03 };
  const at04 = discussMarginAtBc(0.4, providerCostUsd, assumptions.userCreditsPerUsd);
  return { credits: 0.4, margin: at04 };
}

export function actionCreditsFor5x(providerCostUsd, revenueUsdPerAc) {
  if (providerCostUsd <= 0) return 0;
  return Math.ceil((providerCostUsd * MIN_ACTION_MARGIN_MULTIPLIER) / revenueUsdPerAc);
}

export function paddleFee(priceUsd, assumptions = DEFAULT_ASSUMPTIONS) {
  if (priceUsd <= 0) return 0;
  return priceUsd * assumptions.paymentFeePct + assumptions.paymentFeeFixedUsd;
}

export function maxBurnCogsPerUser(plan, assumptions) {
  const build =
    (assumptions.buildCreditsByPlan[plan] ?? 0) * assumptions.providerUsdPerBuildCredit;
  const action =
    (assumptions.actionCreditsByPlan[plan] ?? 0) * assumptions.providerUsdPerActionCredit;
  return build + action;
}

/** Credit-pool max-usage margin (P5.4.1 — formula guarantees ≥75%). */
export function planMaxBurnMargin(plan, assumptions) {
  const price = assumptions.planPriceUsd[plan] ?? 0;
  if (price <= 0) return 0;
  const creditCogs = maxBurnCogsPerUser(plan, assumptions);
  return ((price - creditCogs) / price) * 100;
}

export function freeUserWorstCaseCost(assumptions) {
  const build =
    assumptions.buildCreditsByPlan.free * assumptions.providerUsdPerBuildCredit;
  const action =
    assumptions.actionCreditsByPlan.free * assumptions.providerUsdPerActionCredit;
  const discussTurns = assumptions.freeDiscussTurnsPerMonth ?? 12;
  const discussCost = discussTurns * discussMessageCostUsd(assumptions);
  return build + action + discussCost;
}

export function paidUserWorstCaseCost(plan, assumptions) {
  return maxBurnCogsPerUser(plan, assumptions) + paddleFee(assumptions.planPriceUsd[plan] ?? 0, assumptions);
}

export function blendedMonthlyEconomics(assumptions, label = "new") {
  let mrr = 0;
  let creditCogs = 0;
  const planMargins = {};

  for (const [plan, share] of Object.entries(assumptions.planMix)) {
    const users = assumptions.paidConversionsPerMonth * share;
    const price = assumptions.planPriceUsd[plan] ?? 0;
    mrr += users * price;

    const util = assumptions.paidCreditUtilization;
    const burn = maxBurnCogsPerUser(plan, assumptions) * util;
    const extras =
      users *
      (assumptions.paidZipPreviewRate * assumptions.actionCostsUsd.zipPreviewTier2 +
        assumptions.paidAndroidBuildRate * assumptions.actionCostsUsd.androidBuild);
    creditCogs += users * burn + extras;

    const feeTotal = paddleFee(price, assumptions) * users;
    const planCogs = burn * users + feeTotal + extras;
    planMargins[plan] = {
      price,
      maxBurnMarginPct: planMaxBurnMargin(plan, assumptions),
      blendedMarginPct: price > 0 ? ((price * users - planCogs) / (price * users)) * 100 : 0,
      buildCredits: assumptions.buildCreditsByPlan[plan],
      actionCredits: assumptions.actionCreditsByPlan[plan],
    };
  }

  const freeSignups = Math.max(
    0,
    assumptions.newUsersPerMonth - assumptions.paidConversionsPerMonth,
  );
  const freeActive = Math.min(
    freeSignups,
    assumptions.freeActiveCreditUsersPerMonth ?? freeSignups,
  );
  creditCogs += freeActive * freeUserWorstCaseCost(assumptions) * assumptions.freeCreditUtilization;

  const paymentFees =
    mrr * assumptions.paymentFeePct +
    assumptions.paidConversionsPerMonth * assumptions.paymentFeeFixedUsd;
  const infra = mrr * assumptions.infraCostPctOfRevenue;
  const totalCogs = creditCogs + paymentFees + infra;
  const grossMargin = mrr > 0 ? ((mrr - totalCogs) / mrr) * 100 : 0;

  return { mrr, creditCogs, paymentFees, infra, totalCogs, grossMargin, planMargins };
}

export function sixMonthForecast(assumptions) {
  const base = blendedMonthlyEconomics(assumptions);
  const months = [];
  let cumulativeRevenue = 0;
  let cumulativeGrossProfit = 0;
  let activePaid = 0;

  for (let month = 1; month <= 6; month++) {
    activePaid =
      activePaid * (1 - assumptions.churnMonthlyPct) + assumptions.paidConversionsPerMonth;
    const rev = base.mrr * (activePaid / assumptions.paidConversionsPerMonth);
    const cogs = base.totalCogs * (activePaid / assumptions.paidConversionsPerMonth);
    const grossProfit = rev - cogs;
    cumulativeRevenue += rev;
    cumulativeGrossProfit += grossProfit;
    months.push({ month, mrr: rev, cogs, grossProfit, activePaid: Math.round(activePaid) });
  }

  return {
    months,
    cumulativeRevenue,
    cumulativeGrossProfit,
    grossMarginPct: cumulativeRevenue > 0 ? (cumulativeGrossProfit / cumulativeRevenue) * 100 : 0,
  };
}

export function compareEconomics(assumptions = DEFAULT_ASSUMPTIONS) {
  const current = blendedMonthlyEconomics(
    {
      ...assumptions,
      buildCreditsByPlan: assumptions.currentBuildCreditsByPlan,
      actionCreditsByPlan: assumptions.currentActionCreditsByPlan,
    },
    "current",
  );
  const next = blendedMonthlyEconomics(assumptions, "new");
  const discussCost = discussMessageCostUsd(assumptions);
  const discussRec = recommendDiscussBc(discussCost, assumptions);
  const starterAcRev = actionRevenueUsdPerCredit(
    assumptions.planPriceUsd.starter,
    assumptions.buildCreditsByPlan.starter,
  );
  const starterAcRevAction = actionRevenueUsdPerCredit(
    assumptions.planPriceUsd.starter,
    assumptions.actionCreditsByPlan.starter,
  );

  const actionPricing = {};
  for (const [key, cost] of Object.entries(assumptions.actionCostsUsd)) {
    actionPricing[key] = {
      providerCostUsd: cost,
      creditsAt5x: actionCreditsFor5x(cost, starterAcRevAction),
      marginAtCatalogFloor: null,
    };
  }

  return {
    assumptions,
    discussCostUsd: discussCost,
    discussMarginAt03: discussMarginAtBc(0.3, discussCost, assumptions.userCreditsPerUsd),
    discussMarginAt04: discussMarginAtBc(0.4, discussCost, assumptions.userCreditsPerUsd),
    discussRecommendation: discussRec,
    buildCreditRevenueUsd: 1 / assumptions.userCreditsPerUsd,
    actionCreditRevenueUsdStarter: starterAcRevAction,
    freeUserMaxMonthlyCost: freeUserWorstCaseCost(assumptions),
    currentGrossMarginPct: current.grossMargin,
    newGrossMarginPct: next.grossMargin,
    current,
    new: next,
    actionPricing,
    sixMonth: sixMonthForecast(assumptions),
    maxBurnRisk: (() => {
      const freeSignups = Math.max(
        0,
        assumptions.newUsersPerMonth - assumptions.paidConversionsPerMonth,
      );
      let paidMaxCogs = 0;
      for (const [plan, share] of Object.entries(assumptions.planMix)) {
        const users = assumptions.paidConversionsPerMonth * share;
        paidMaxCogs +=
          users * maxBurnCogsPerUser(plan, assumptions) +
          users *
            (assumptions.paidZipPreviewRate * assumptions.actionCostsUsd.zipPreviewTier2 +
              assumptions.paidAndroidBuildRate * assumptions.actionCostsUsd.androidBuild);
      }
      const freeMax = freeSignups * freeUserWorstCaseCost(assumptions);
      const totalMax = paidMaxCogs + freeMax + next.paymentFees + next.infra;
      return {
        allUsersMaxCreditsMarginPct: next.mrr > 0 ? ((next.mrr - totalMax) / next.mrr) * 100 : 0,
        realisticBlendedMarginPct: next.grossMargin,
        freeSignups,
        freeActiveAssumption: Math.min(
          freeSignups,
          assumptions.freeActiveCreditUsersPerMonth ?? freeSignups,
        ),
        paidMaxCreditCogs: paidMaxCogs,
        freeMaxCreditCogs: freeMax,
        realisticCreditCogs: next.creditCogs,
      };
    })(),
  };
}
