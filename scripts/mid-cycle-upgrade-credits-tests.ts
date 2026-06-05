import assert from "node:assert/strict";
import { computeUpgradeCycleCredits } from "../src/lib/billing/mid-cycle-upgrade-credits";
import { monthlyTokensForPlan } from "../src/lib/billing/plans";
import { monthlyActionCreditsForPlan } from "../src/lib/action-credits/action-credit-allowances";

function run() {
  // Documented example: used all build credits, 400 AC remaining on old plan → upgrade preserves usage.
  const oldPlan = "pro";
  const newPlan = "infinity_i";
  const bcRem = 0;
  const acRem = 400;
  const r = computeUpgradeCycleCredits({
    oldPlan,
    newPlan,
    buildRemainingBefore: bcRem,
    actionRemainingBefore: acRem,
    explicitBuildBonus: 0,
    explicitActionBonus: 0,
  });
  const oldBC = monthlyTokensForPlan(oldPlan);
  const newBC = monthlyTokensForPlan(newPlan);
  const oldAC = monthlyActionCreditsForPlan(oldPlan);
  const newAC = monthlyActionCreditsForPlan(newPlan);
  const usedBC = oldBC - bcRem;
  const usedAC = oldAC - acRem;
  assert.equal(r.buildCredits, newBC - usedBC, "build: new_remaining = new_cap - used");
  assert.equal(r.actionCredits, newAC - usedAC, "action: new_remaining = new_cap - used");

  // User-style Infinity I → II with full BC usage
  const inf = computeUpgradeCycleCredits({
    oldPlan: "infinity_i",
    newPlan: "infinity_ii",
    buildRemainingBefore: 0,
    actionRemainingBefore: 400,
    explicitBuildBonus: 0,
    explicitActionBonus: 0,
  });
  const i1bc = monthlyTokensForPlan("infinity_i");
  const i2bc = monthlyTokensForPlan("infinity_ii");
  const i1ac = monthlyActionCreditsForPlan("infinity_i");
  const i2ac = monthlyActionCreditsForPlan("infinity_ii");
  assert.equal(inf.buildCredits, i2bc - (i1bc - 0));
  assert.equal(inf.actionCredits, i2ac - (i1ac - 400));

  // Free → paid preserves usage flag
  const c = computeUpgradeCycleCredits({
    oldPlan: "free",
    newPlan: "starter",
    buildRemainingBefore: 10,
    actionRemainingBefore: 50,
    explicitBuildBonus: 0,
    explicitActionBonus: 0,
  });
  assert.equal(c.midCyclePreserveUsage, true);

  console.log("mid-cycle-upgrade-credits-tests OK");
}

run();
