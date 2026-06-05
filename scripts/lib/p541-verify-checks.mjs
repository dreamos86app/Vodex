import fs from "node:fs";
import path from "node:path";
import { createChecker } from "./p42-verify-checks.mjs";
import {
  BUILD_CREDITS_PER_DOLLAR,
  ACTION_CREDITS_PER_DOLLAR,
  MIN_MONTHLY_CREDIT_MARGIN_PERCENT,
  MIN_ANNUAL_CREDIT_MARGIN_PERCENT,
  creditsFromMonthlyListPrice,
  planAllowancesFromLadder,
  assertMonotonicLadder,
} from "./credit-formula.mjs";
import { forecastPassFail, planRows } from "./profit-forecast-model.mjs";
import { auditAllActions } from "./action-cost-audit.mjs";

/** P5.4 broken values that must not return. */
const P54_BROKEN = [
  ["infinity_iv: 3_000", "P5.4 flat IV BC"],
  ["infinity_vi: 3_500", "P5.4 VI BC drop"],
  ["infinity_v: 14_000", "P5.4 V AC without formula"],
  ["derivedMaxBurnActionPoolUsdPerCredit", "P5.4 per-plan optimizer"],
];

const TARGET_TABLE = {
  free: { bc: 20, ac: 20, price: 0 },
  starter: { bc: 150, ac: 500, price: 20 },
  pro: { bc: 375, ac: 1250, price: 50 },
  infinity_i: { bc: 750, ac: 2500, price: 100 },
  infinity_ii: { bc: 1500, ac: 5000, price: 200 },
  infinity_iii: { bc: 2250, ac: 7500, price: 300 },
  infinity_iv: { bc: 2850, ac: 9500, price: 380 },
  infinity_v: { bc: 4250, ac: 14250, price: 570 },
  infinity_vi: { bc: 6400, ac: 21375, price: 855 },
  infinity_vii: { bc: 9250, ac: 30875, price: 1235 },
};

export function P541_CREDIT_ECONOMY(root) {
  const errors = [];
  const { must, mustExist } = createChecker(root);

  mustExist("src/lib/billing/credit-formula.ts", "credit-formula");
  must("src/lib/billing/credit-formula.ts", "BUILD_CREDITS_PER_DOLLAR = 7.5", "7.5 BC/$");
  must("src/lib/billing/billing-constants.ts", "ACTION_CREDITS_PER_DOLLAR = 25", "25 AC/$");
  mustExist("scripts/audit-profit-forecast.mjs", "profit forecast audit");

  const econPath = path.join(root, "src/lib/billing/plan-credit-economics.ts");
  const econ = fs.readFileSync(econPath, "utf8");
  for (const [needle, label] of P54_BROKEN) {
    if (econ.includes(needle)) errors.push(`stale ${label}`);
  }

  const ladder = planAllowancesFromLadder();
  const mono = assertMonotonicLadder(ladder);
  errors.push(...mono);

  const vi = ladder.find((r) => r.id === "infinity_vi");
  const v = ladder.find((r) => r.id === "infinity_v");
  if (vi && v && vi.buildCredits < v.buildCredits) {
    errors.push(`Infinity VI BC ${vi.buildCredits} < V ${v.buildCredits}`);
  }

  const vii = ladder.find((r) => r.id === "infinity_vii");
  if (vii && vii.buildCredits > 13000) {
    errors.push(`Infinity VII BC ${vii.buildCredits} exceeds 13,000 cap`);
  }

  const iii = ladder.find((r) => r.id === "infinity_iii");
  const iv = ladder.find((r) => r.id === "infinity_iv");
  if (iii && iv && iv.buildCredits <= iii.buildCredits) {
    errors.push(`Infinity IV BC must exceed III`);
  }

  for (const [id, target] of Object.entries(TARGET_TABLE)) {
    const row = ladder.find((r) => r.id === id);
    if (!row) {
      errors.push(`missing plan ${id}`);
      continue;
    }
    if (row.buildCredits !== target.bc) {
      errors.push(`${id} BC ${row.buildCredits} !== target ${target.bc}`);
    }
    if (row.actionCredits !== target.ac) {
      errors.push(`${id} AC ${row.actionCredits} !== target ${target.ac}`);
    }
  }

  for (const row of ladder.filter((r) => r.monthlyPriceUsd > 0)) {
    const bcRatio = row.buildCredits / row.monthlyPriceUsd;
    const acRatio = row.actionCredits / row.monthlyPriceUsd;
    if (Math.abs(bcRatio - BUILD_CREDITS_PER_DOLLAR) > 0.6) {
      errors.push(`${row.id} BC/$ ${bcRatio.toFixed(2)} off formula`);
    }
    if (Math.abs(acRatio - ACTION_CREDITS_PER_DOLLAR) > 1) {
      errors.push(`${row.id} AC/$ ${acRatio.toFixed(2)} off formula`);
    }
  }

  const plans = planRows();
  for (const p of plans.filter((x) => x.monthlyPriceUsd > 0)) {
    if (p.monthlyCreditMargin < MIN_MONTHLY_CREDIT_MARGIN_PERCENT - 0.1) {
      errors.push(`${p.id} monthly credit margin ${p.monthlyCreditMargin.toFixed(1)}% < ${MIN_MONTHLY_CREDIT_MARGIN_PERCENT}%`);
    }
    if (p.annualCreditMargin < MIN_ANNUAL_CREDIT_MARGIN_PERCENT - 0.1) {
      errors.push(`${p.id} annual credit margin ${p.annualCreditMargin.toFixed(1)}% < ${MIN_ANNUAL_CREDIT_MARGIN_PERCENT}%`);
    }
  }

  const pricingPath = path.join(root, "src/components/pricing/pricing-view.tsx");
  const pricing = fs.readFileSync(pricingPath, "utf8");
  if (!pricing.includes("750") || pricing.includes("credits: 3_000")) {
    if (pricing.match(/inf-4.*credits:\s*3_000/)) errors.push("pricing UI stale Infinity IV BC");
  }
  if (pricing.includes('starter: "185"')) errors.push("pricing comparison stale starter BC");

  const migPath = path.join(root, "supabase/migrations/20260829120000_p541_credit_economy_formula_repair.sql");
  if (!fs.existsSync(migPath)) errors.push("P5.4.1 migration missing");

  const forecast = forecastPassFail();
  if (!forecast.ok) errors.push(...forecast.failures);

  const failedActions = auditAllActions().filter((r) => !r.pass && r.totalCost > 0);
  if (failedActions.length) errors.push(`${failedActions.length} actions below 5x in registry audit`);

  must("src/components/chat/chat-view.tsx", "DISCUSS_MODEL_AUTO", "no discuss model picker");

  return errors;
}
