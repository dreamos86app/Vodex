#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { P53_CREDIT_PRICING } from "./lib/p53-verify-checks.mjs";
import { compareEconomics, DEFAULT_ASSUMPTIONS, MIN_ACTION_MARGIN_MULTIPLIER } from "./lib/unit-economics-model.mjs";
import { actionCreditsFor5x, actionRevenueUsdPerCredit } from "./lib/unit-economics-model.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = P53_CREDIT_PRICING(root);

const revAc = actionRevenueUsdPerCredit(
  DEFAULT_ASSUMPTIONS.planPriceUsd.starter,
  DEFAULT_ASSUMPTIONS.actionCreditsByPlan.starter,
);
for (const [key, cost] of Object.entries(DEFAULT_ASSUMPTIONS.actionCostsUsd)) {
  const credits = actionCreditsFor5x(cost, revAc);
  const margin = (credits * revAc) / cost;
  if (margin < MIN_ACTION_MARGIN_MULTIPLIER - 0.05) {
    errors.push(`${key} margin ${margin.toFixed(2)}x below ${MIN_ACTION_MARGIN_MULTIPLIER}x`);
  }
}

const report = compareEconomics(DEFAULT_ASSUMPTIONS);
const discussRec = report.discussRecommendation;
if (discussRec.margin < 5) {
  errors.push(`discuss ${discussRec.credits} BC margin ${discussRec.margin.toFixed(1)}x < 5x`);
}

if (errors.length) {
  console.error("✗ verify:p53-credit-pricing");
  errors.forEach((e) => console.error(" ", e));
  process.exit(1);
}
console.log("✓ verify:p53-credit-pricing");
