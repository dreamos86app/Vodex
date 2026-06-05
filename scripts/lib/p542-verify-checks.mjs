import fs from "node:fs";
import path from "node:path";
import { createChecker } from "./p42-verify-checks.mjs";
import {
  ACTION_CREDITS_PER_DOLLAR,
  BUILD_CREDITS_PER_DOLLAR,
  FIXED_PLAN_CREDITS,
  STARTER_MIN_ANNUAL_FULL_MARGIN_PERCENT,
  STARTER_MIN_MONTHLY_FULL_MARGIN_PERCENT,
  MIN_PAID_ANNUAL_FULL_MARGIN_PERCENT,
  MIN_PAID_MONTHLY_FULL_MARGIN_PERCENT,
  assertMonotonicLadder,
  planAllowancesFromLadder,
} from "./credit-formula.mjs";
import { forecastPassFail, planRows } from "./profit-forecast-model.mjs";
import { auditAllActions } from "./action-cost-audit.mjs";

const TARGET = FIXED_PLAN_CREDITS;

const P54_STALE = [
  ["ACTION_CREDITS_PER_DOLLAR = 25", "P5.4.1 25 AC/$"],
  ["actionCredits: 30_875", "old VII AC"],
  ["buildCredits: 9_250", "old VII BC without 9300"],
  ["infinity_vi: 6_400", "old VI BC 6400 not 6500"],
];

export function P542_CREDIT_ECONOMY(root) {
  const errors = [];
  const { must, mustExist } = createChecker(root);

  mustExist("src/lib/billing/credit-formula.ts", "credit-formula");
  must("src/lib/billing/billing-constants.ts", "ACTION_CREDITS_PER_DOLLAR = 20", "20 AC/$");
  must("src/lib/billing/credit-formula.ts", "BUILD_CREDITS_PER_DOLLAR = 7.5", "7.5 BC/$");
  mustExist("scripts/audit-profit-forecast.mjs", "profit forecast");

  const econ = fs.readFileSync(path.join(root, "src/lib/billing/plan-credit-economics.ts"), "utf8");
  for (const [needle, label] of P54_STALE) {
    if (econ.includes(needle) || fs.readFileSync(path.join(root, "src/lib/billing/billing-constants.ts"), "utf8").includes(needle)) {
      errors.push(`stale ${label}`);
    }
  }

  const ladder = planAllowancesFromLadder();
  errors.push(...assertMonotonicLadder(ladder));

  for (const [id, row] of Object.entries(TARGET)) {
    const got = ladder.find((r) => r.id === id);
    if (!got) {
      errors.push(`missing ${id}`);
      continue;
    }
    if (got.buildCredits !== row.buildCredits) errors.push(`${id} BC ${got.buildCredits} != ${row.buildCredits}`);
    if (got.actionCredits !== row.actionCredits) errors.push(`${id} AC ${got.actionCredits} != ${row.actionCredits}`);
  }

  const vi = ladder.find((r) => r.id === "infinity_vi");
  const v = ladder.find((r) => r.id === "infinity_v");
  if (vi && v && vi.buildCredits <= v.buildCredits) errors.push("Infinity VI BC must exceed V");

  const vii = ladder.find((r) => r.id === "infinity_vii");
  if (vii && (vii.buildCredits === 9250 || vii.buildCredits === 6412)) {
    errors.push("Infinity VII BC not cleanly rounded (expected 9300)");
  }
  if (vii && vi && vi.buildCredits !== 6500) errors.push(`Infinity VI BC expected 6500 got ${vi?.buildCredits}`);
  if (vii && vii.actionCredits < 24700) errors.push("Infinity VII AC too low");
  if (vii && vii.actionCredits > 25000) errors.push("Infinity VII AC exceeds 25000");

  const plans = planRows();
  const starter = plans.find((p) => p.id === "starter");
  if (starter) {
    if (starter.monthlyContributionMarginPct < STARTER_MIN_MONTHLY_FULL_MARGIN_PERCENT - 0.15) {
      errors.push(`starter monthly max margin ${starter.monthlyContributionMarginPct.toFixed(1)}% < ${STARTER_MIN_MONTHLY_FULL_MARGIN_PERCENT}%`);
    }
    if (starter.annualContributionMarginPct < STARTER_MIN_ANNUAL_FULL_MARGIN_PERCENT - 0.15) {
      errors.push(`starter annual max margin ${starter.annualContributionMarginPct.toFixed(1)}% < ${STARTER_MIN_ANNUAL_FULL_MARGIN_PERCENT}%`);
    }
  }

  for (const p of plans.filter((x) => x.monthlyPriceUsd > 0 && x.id !== "starter")) {
    if (p.monthlyContributionMarginPct < MIN_PAID_MONTHLY_FULL_MARGIN_PERCENT - 0.15) {
      errors.push(`${p.id} monthly max margin ${p.monthlyContributionMarginPct.toFixed(1)}%`);
    }
    if (p.annualContributionMarginPct < MIN_PAID_ANNUAL_FULL_MARGIN_PERCENT - 0.15) {
      errors.push(`${p.id} annual max margin ${p.annualContributionMarginPct.toFixed(1)}%`);
    }
  }

  for (const p of plans.filter((x) => x.monthlyPriceUsd > 0)) {
    const acRatio = p.actionCredits / p.monthlyPriceUsd;
    if (Math.abs(acRatio - ACTION_CREDITS_PER_DOLLAR) > 0.6) {
      errors.push(`${p.id} AC/$ ${acRatio.toFixed(2)} off ${ACTION_CREDITS_PER_DOLLAR}`);
    }
    const bcRatio = p.buildCredits / p.monthlyPriceUsd;
    if (Math.abs(bcRatio - BUILD_CREDITS_PER_DOLLAR) > 0.6) {
      errors.push(`${p.id} BC/$ ${bcRatio.toFixed(2)} off ${BUILD_CREDITS_PER_DOLLAR}`);
    }
  }

  const pricing = fs.readFileSync(path.join(root, "src/components/pricing/pricing-view.tsx"), "utf8");
  if (!pricing.includes("credits: 6_500") || !pricing.includes("credits: 9_300")) {
    errors.push("pricing UI missing clean VI/VII BC");
  }
  if (!pricing.includes('starter: "400"')) errors.push("pricing starter AC not 400");
  if (!pricing.includes("2,000–25,000")) errors.push("pricing AC range stale");

  const mig = path.join(root, "supabase/migrations/20260830120000_p542_starter_margin_credit_ladder.sql");
  if (!fs.existsSync(mig)) errors.push("P5.4.2 migration missing");

  const forecast = forecastPassFail();
  if (!forecast.ok) errors.push(...forecast.failures);

  const failedActions = auditAllActions().filter((r) => !r.pass && r.totalCost > 0);
  if (failedActions.length) errors.push(`${failedActions.length} actions below 5x`);

  must("src/components/chat/chat-view.tsx", "DISCUSS_MODEL_AUTO", "discuss policy");

  return errors;
}
