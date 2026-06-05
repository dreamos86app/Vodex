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

const P542_STALE = [
  ["buildCredits: 150", "P5.4.2 starter 150 BC"],
  ["actionCredits: 400", "P5.4.2 starter 400 AC"],
  ["ACTION_CREDITS_PER_DOLLAR = 20", "P5.4.2 20 AC/$"],
  ["BUILD_CREDITS_PER_DOLLAR = 7.5", "P5.4.x 7.5 BC/$"],
  ["credits: 6_500", "old VI BC 6500"],
  ["credits: 9_300", "old VII BC 9300"],
  ["starter: \"400\"", "old starter AC UI"],
];

export function P543_CREDIT_ECONOMY(root) {
  const errors = [];
  const { must, mustExist } = createChecker(root);

  mustExist("src/lib/billing/credit-formula.ts", "credit-formula");
  must("src/lib/billing/billing-constants.ts", "ACTION_CREDITS_PER_DOLLAR = 7.6", "7.6 AC/$");
  must("src/lib/billing/credit-formula.ts", "BUILD_CREDITS_PER_DOLLAR = 2.85", "2.85 BC/$");
  mustExist("scripts/audit-profit-forecast.mjs", "profit forecast");

  const econPath = path.join(root, "src/lib/billing/plan-credit-economics.ts");
  const econ = fs.readFileSync(econPath, "utf8");
  const constants = fs.readFileSync(
    path.join(root, "src/lib/billing/billing-constants.ts"),
    "utf8",
  );
  for (const [needle, label] of P542_STALE) {
    if (econ.includes(needle) || constants.includes(needle)) {
      errors.push(`stale ${label}`);
    }
  }

  if (econ.includes("monthlyContributionMaxUsageMarginPercent")) {
    errors.push("plan-credit-economics still gates on contribution margin");
  }

  const ladder = planAllowancesFromLadder();
  errors.push(...assertMonotonicLadder(ladder));

  for (const [id, row] of Object.entries(TARGET)) {
    const got = ladder.find((r) => r.id === id);
    if (!got) {
      errors.push(`missing ${id}`);
      continue;
    }
    if (got.buildCredits !== row.buildCredits) {
      errors.push(`${id} BC ${got.buildCredits} != ${row.buildCredits}`);
    }
    if (got.actionCredits !== row.actionCredits) {
      errors.push(`${id} AC ${got.actionCredits} != ${row.actionCredits}`);
    }
  }

  const starterRow = ladder.find((r) => r.id === "starter");
  if (starterRow && (starterRow.buildCredits !== 57 || starterRow.actionCredits !== 152)) {
    errors.push("starter must be 57 BC / 152 AC (max safe full-gross pair)");
  }

  const plans = planRows();
  const starter = plans.find((p) => p.id === "starter");
  if (starter) {
    if (starter.monthlyFullMarginPct < STARTER_MIN_MONTHLY_FULL_MARGIN_PERCENT - 0.15) {
      errors.push(
        `starter monthly full gross ${starter.monthlyFullMarginPct.toFixed(1)}% < ${STARTER_MIN_MONTHLY_FULL_MARGIN_PERCENT}%`,
      );
    }
    if (starter.annualFullMarginPct < STARTER_MIN_ANNUAL_FULL_MARGIN_PERCENT - 0.15) {
      errors.push(
        `starter annual full gross ${starter.annualFullMarginPct.toFixed(1)}% < ${STARTER_MIN_ANNUAL_FULL_MARGIN_PERCENT}%`,
      );
    }
  }

  for (const p of plans.filter((x) => x.monthlyPriceUsd > 0 && x.id !== "starter")) {
    if (p.monthlyFullMarginPct < MIN_PAID_MONTHLY_FULL_MARGIN_PERCENT - 0.15) {
      errors.push(`${p.id} monthly full gross ${p.monthlyFullMarginPct.toFixed(1)}%`);
    }
    if (p.annualFullMarginPct < MIN_PAID_ANNUAL_FULL_MARGIN_PERCENT - 0.15) {
      errors.push(`${p.id} annual full gross ${p.annualFullMarginPct.toFixed(1)}%`);
    }
  }

  for (const p of plans.filter((x) => x.monthlyPriceUsd > 0)) {
    const acRatio = p.actionCredits / p.monthlyPriceUsd;
    if (Math.abs(acRatio - ACTION_CREDITS_PER_DOLLAR) > 0.35) {
      errors.push(`${p.id} AC/$ ${acRatio.toFixed(2)} off ${ACTION_CREDITS_PER_DOLLAR}`);
    }
    const bcRatio = p.buildCredits / p.monthlyPriceUsd;
    if (Math.abs(bcRatio - BUILD_CREDITS_PER_DOLLAR) > 0.35) {
      errors.push(`${p.id} BC/$ ${bcRatio.toFixed(2)} off ${BUILD_CREDITS_PER_DOLLAR}`);
    }
  }

  const pricing = fs.readFileSync(path.join(root, "src/components/pricing/pricing-view.tsx"), "utf8");
  if (!pricing.includes("credits: 2_430") || !pricing.includes("credits: 3_520")) {
    errors.push("pricing UI missing P5.4.3 VI/VII BC");
  }
  if (!pricing.includes('starter: "57"') || !pricing.includes('starter: "152"')) {
    errors.push("pricing starter credits not 57/152");
  }
  if (!pricing.includes("750–9,400")) errors.push("pricing AC range stale");

  const mig = path.join(root, "supabase/migrations/20260831120000_p543_full_gross_margin_credit_ladder.sql");
  if (!fs.existsSync(mig)) errors.push("P5.4.3 migration missing");

  const forecastModel = fs.readFileSync(
    path.join(root, "scripts/lib/profit-forecast-model.mjs"),
    "utf8",
  );
  if (forecastModel.includes("monthlyContributionMarginPct < STARTER_MIN")) {
    errors.push("profit-forecast still gates on contribution margin");
  }

  const forecast = forecastPassFail();
  if (!forecast.ok) errors.push(...forecast.failures);

  const failedActions = auditAllActions().filter((r) => !r.pass && r.totalCost > 0);
  if (failedActions.length) errors.push(`${failedActions.length} actions below 5x`);

  must("src/components/chat/chat-view.tsx", "DISCUSS_MODEL_AUTO", "discuss policy");

  return errors;
}
