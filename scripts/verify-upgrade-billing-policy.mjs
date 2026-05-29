#!/usr/bin/env node
/**
 * Static verification for no-prorated upgrade billing policy.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function mustExist(rel) {
  if (!fs.existsSync(path.join(root, rel))) errors.push(`missing ${rel}`);
  else ok.push(`exists ${rel}`);
}

function mustInclude(rel, needles, label) {
  const t = read(rel);
  for (const n of needles) {
    if (!t.includes(n)) errors.push(`${label ?? rel} missing: ${n}`);
  }
}

function mustNotInclude(rel, needles, label) {
  const t = read(rel);
  for (const n of needles) {
    if (t.includes(n)) errors.push(`${label ?? rel} must not include: ${n}`);
  }
}

// Core modules
mustExist("src/lib/billing/apply-immediate-plan-upgrade.ts");
mustExist("src/lib/billing/upgrade-policy.ts");
mustExist("src/lib/billing/billing-event-idempotency.ts");
mustExist("src/app/api/billing/paddle/upgrade/route.ts");
mustExist("src/app/api/billing/paddle/upgrade/preview/route.ts");
mustExist("src/app/api/billing/paddle/downgrade/route.ts");
mustExist("src/components/billing/plan-upgrade-modal.tsx");

mustInclude("src/lib/billing/upgrade-policy.ts", ["full_immediately", "PADDLE_UPGRADE_PRORATION_MODE"]);
mustInclude("src/lib/billing/paddle-api.ts", [
  "proration_billing_mode",
  "PADDLE_UPGRADE_PRORATION_MODE",
]);
mustInclude("src/lib/billing/apply-immediate-plan-upgrade.ts", [
  "full_cycle_restart: true",
  "explicit_build_bonus_preserved",
  "applyImmediatePlanUpgrade",
]);
mustInclude("src/lib/billing/paddle-webhook-handlers.ts", [
  "handlePaddleTransactionCompleted",
  "applyImmediatePlanUpgrade",
]);
mustNotInclude("src/lib/billing/paddle-api.ts", ["prorated_immediately", "prorated_next_billing_period"]);

const webhook = read("src/lib/billing/paddle-webhook-handlers.ts");
if (/subscription\.updated[\s\S]{0,800}syncPlanCreditsForUser/.test(webhook)) {
  errors.push("subscription.updated must not call syncPlanCreditsForUser directly");
} else {
  ok.push("subscription.updated does not auto-sync credits");
}

const upgradeRoute = read("src/app/api/billing/paddle/upgrade/route.ts");
if (!upgradeRoute.includes("proratedAmountUsd: null")) {
  errors.push("upgrade route must expose proratedAmountUsd: null");
}
if (!upgradeRoute.includes("full_immediately")) {
  errors.push("upgrade route must reference full_immediately");
}

const previewRoute = read("src/app/api/billing/paddle/upgrade/preview/route.ts");
if (!previewRoute.includes("prorationPolicy: \"none\"")) {
  errors.push("upgrade preview must set prorationPolicy none");
}

const pricingFaq = read("src/components/pricing/pricing-view.tsx");
mustNotInclude("src/components/pricing/pricing-view.tsx", [
  "prorated billing for the rest of your period",
]);
mustInclude("src/components/pricing/pricing-view.tsx", [
  "Plan upgrades are not prorated",
  "full new plan price today",
], "pricing FAQ");

const modal = read("src/components/billing/plan-upgrade-modal.tsx");
mustInclude("src/components/billing/plan-upgrade-modal.tsx", [
  "UPGRADE_POLICY_COPY.amountDueToday",
  "UPGRADE_POLICY_COPY.noProration",
  "policyMessage",
]);
mustNotInclude("src/components/billing/plan-upgrade-modal.tsx", [
  "prorated billing",
  "remaining days",
]);

const downgrade = read("src/app/api/billing/paddle/downgrade/route.ts");
mustInclude("src/app/api/billing/paddle/downgrade/route.ts", ["pending_downgrade_plan", "next billing cycle"]);

const idempotency = read("src/lib/billing/billing-event-idempotency.ts");
mustInclude("src/lib/billing/billing-event-idempotency.ts", ["23505", "claimBillingEvent"]);

console.log("\n=== verify:upgrade-billing-policy ===\n");
ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
process.exit(errors.length ? 1 : 0);
