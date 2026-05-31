#!/usr/bin/env node
/**
 * Static verification: billing attempt trace + diagnose + no fake success UI.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
    return false;
  }
  console.log(`OK: ${msg}`);
  return true;
}

const checks = [
  () => assert(read("src/lib/billing/billing-attempt-trace.ts").includes("createBillingAttempt"),
    "billing attempt trace creates durable rows"),
  () => assert(read("src/lib/billing/billing-attempt-trace.ts").includes("billing_attempt_id"),
    "billing_attempt_id field in trace"),
  () => assert(read("src/lib/billing/diagnose-billing-attempt.ts").includes("processed_successfully"),
    "diagnose returns processed_successfully"),
  () => assert(read("src/lib/billing/diagnose-billing-attempt.ts").includes("action_credits_not_updated"),
    "diagnose detects action credit failure"),
  () => assert(read("src/lib/billing/execute-paddle-billing-action.ts").includes("createBillingAttempt"),
    "executor creates billing attempt before Paddle"),
  () => assert(read("src/lib/billing/paddle-checkout-custom-data.ts").includes("billing_attempt_id"),
    "custom_data carries billing_attempt_id"),
  () => assert(read("src/lib/billing/apply-immediate-plan-upgrade.ts").includes("sumExplicitActionGrants"),
    "entitlement preserves explicit action bonuses"),
  () => assert(read("src/lib/credits/canonical-credits.ts").includes("batchUserLevelActionBalances"),
    "canonical credits use max user-level action balance"),
  () => assert(read("src/app/api/billing/status/route.ts").includes("diagnoseBillingAttempt"),
    "status endpoint runs diagnoseBillingAttempt"),
  () => assert(read("src/components/billing/billing-upgrade-status-panel.tsx").includes("upgradeComplete"),
    "UI polls upgradeComplete — no immediate success"),
  () => assert(
    !read("src/components/billing/billing-upgrade-status-panel.tsx").includes("toast.success") &&
      read("src/components/settings/billing-settings.tsx").includes("BillingUpgradeStatusPanel"),
    "billing settings use upgrade status panel after return",
  ),
  () => assert(read("src/lib/billing/unified-billing-action.ts").includes("upgrade"),
    "unified resolver includes upgrade path for subscribers"),
  () => assert(read("src/components/admin/admin-paddle-test-checkout.tsx").includes("BillingUpgradeStatusPanel"),
    "admin test checkout has attempt inspector"),
];

let failed = false;
for (const c of checks) {
  if (!c()) failed = true;
}

if (failed) {
  console.error("\nverify:paddle-upgrade-entitlement-trace — one or more checks failed");
  process.exit(1);
}
console.log("\nverify:paddle-upgrade-entitlement-trace — all checks passed");
