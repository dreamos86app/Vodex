import fs from "node:fs";
import path from "node:path";
import { createChecker } from "./p42-verify-checks.mjs";
import {
  ACTION_CREDITS_PER_DOLLAR,
  BUILD_CREDITS_PER_DOLLAR,
  FIXED_PLAN_CREDITS,
  P544_FROZEN_CREDIT_LADDER,
  assertMonotonicLadder,
  planAllowancesFromLadder,
} from "./credit-formula.mjs";
import { forecastPassFail } from "./profit-forecast-model.mjs";
import { auditAllActions } from "./action-cost-audit.mjs";
import { p544Summary } from "./p544-margin-model.mjs";

const FROZEN = {
  starter: { bc: 150, ac: 400 },
  pro: { bc: 375, ac: 1000 },
  infinity_vi: { bc: 6500, ac: 17100 },
  infinity_vii: { bc: 9300, ac: 25000 },
};

export function P544_MARGIN_OPTIMIZATION(root) {
  const errors = [];
  const { must, mustExist } = createChecker(root);

  if (!P544_FROZEN_CREDIT_LADDER) errors.push("P544_FROZEN_CREDIT_LADDER must be true");
  must("src/lib/billing/billing-constants.ts", "ACTION_CREDITS_PER_DOLLAR = 20", "20 AC/$");
  must("src/lib/billing/credit-formula.ts", "BUILD_CREDITS_PER_DOLLAR = 7.5", "7.5 BC/$");
  must("src/lib/billing/build-credit-floors.ts", "first_build_advanced: 9", "P5.4.4 build floors");
  must("src/lib/action-credits/action-catalog.ts", "zip_preview_build: { floor: 140", "ZIP floor 140");
  mustExist("scripts/audit-p544-margin-optimization.mjs", "p544 audit");

  const ladder = planAllowancesFromLadder();
  errors.push(...assertMonotonicLadder(ladder));

  for (const [id, want] of Object.entries(FROZEN)) {
    const got = ladder.find((r) => r.id === id);
    if (!got || got.buildCredits !== want.bc || got.actionCredits !== want.ac) {
      errors.push(`${id} must be ${want.bc} BC / ${want.ac} AC`);
    }
  }

  const pricing = fs.readFileSync(path.join(root, "src/components/pricing/pricing-view.tsx"), "utf8");
  if (!pricing.includes('starter: "150"') || !pricing.includes('starter: "400"')) {
    errors.push("pricing UI starter credits not frozen");
  }

  const failedActions = auditAllActions().filter((r) => !r.pass && r.totalCost > 0);
  if (failedActions.length) errors.push(`${failedActions.length} actions below 5x`);

  const forecast = forecastPassFail();
  if (!forecast.ok) errors.push(...forecast.failures);

  const summary = p544Summary();
  if (summary.simulations.sim5k.delta.marginPts < 0.5) {
    errors.push("optimized economy margin uplift < 0.5 pts at 5k users");
  }

  const mig = path.join(root, "supabase/migrations/20260832120000_p544_margin_optimization_frozen_ladder.sql");
  if (!fs.existsSync(mig)) errors.push("P5.4.4 migration missing");

  return errors;
}
