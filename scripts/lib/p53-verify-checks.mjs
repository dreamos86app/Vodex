import fs from "node:fs";
import path from "node:path";
import { createChecker } from "./p42-verify-checks.mjs";
import {
  compareEconomics,
  DEFAULT_ASSUMPTIONS,
  TARGET_GROSS_MARGIN_PERCENT,
  MIN_ACTION_MARGIN_MULTIPLIER,
} from "./unit-economics-model.mjs";

export const P53_UNIT_ECONOMICS = (root) => {
  const errors = [];
  const report = compareEconomics(DEFAULT_ASSUMPTIONS);
  if (report.newGrossMarginPct < TARGET_GROSS_MARGIN_PERCENT) {
    errors.push(
      `blended gross margin ${report.newGrossMarginPct.toFixed(1)}% < ${TARGET_GROSS_MARGIN_PERCENT}%`,
    );
  }
  const auditPath = path.join(root, "scripts/audit-unit-economics.mjs");
  if (!fs.existsSync(auditPath)) errors.push("audit-unit-economics.mjs missing");
  else {
    const src = fs.readFileSync(auditPath, "utf8");
    if (!src.includes("6-month forecast") && !src.includes("sixMonthForecast")) {
      errors.push("audit must include 6-month forecast");
    }
    if (!src.includes("discussMarginAt03")) errors.push("audit must compare 0.3 vs 0.4 discuss");
  }
  return errors;
};

export const P53_CREDIT_PRICING = (root) => {
  const { errors, must, mustExist } = createChecker(root);
  mustExist("src/lib/billing/discuss-credit-pricing.ts", "discuss pricing");
  must("src/lib/billing/discuss-credit-pricing.ts", "DISCUSS_BC_TIER_STANDARD = 0.3", "discuss 0.3 tier");
  must("src/lib/billing/discuss-credit-pricing.ts", "DISCUSS_BC_TIER_PROTECTED = 0.4", "discuss 0.4 tier");
  must("src/lib/billing/discuss-credit-pricing.ts", "MIN_DISCUSS_MARGIN_MULTIPLIER = 5", "discuss 5x");
  must("src/lib/billing/plan-credit-economics.ts", "free: 20", "free 20 BC");
  must("src/lib/action-credits/action-credit-pricing.ts", "MIN_ACTION_MARGIN_MULTIPLIER = 5", "action 5x");
  must("src/lib/billing/pricing-config.ts", "TARGET_REVENUE_MULTIPLIER = 5", "build 5x");
  mustExist("src/lib/billing/action-cost-registry.ts", "action cost registry");
  must("src/components/chat/chat-view.tsx", "DISCUSS_MODEL_AUTO", "no discuss model picker");
  must("src/lib/ai/discuss-mode-policy.ts", "pickCheapestSafeDiscussModel", "cheapest discuss model");
  mustNotStaleAllowances(root, errors);
  return errors;
};

function mustNotStaleAllowances(root, errors) {
  const econ = fs.readFileSync(path.join(root, "src/lib/billing/plan-credit-economics.ts"), "utf8");
  const stale = [
    ["starter: 200", "stale starter build 200"],
    ["pro: 500", "stale pro build 500"],
    ["free: 25", "stale free action 25"],
    ["starter: 500", "stale starter action 500"],
    ["pro: 1_250", "stale pro action 1250"],
  ];
  for (const [needle, label] of stale) {
    if (econ.includes(needle)) errors.push(label);
  }
  const expected = [
    ["free: 20", "free BC"],
    ["starter: 185", "starter BC"],
    ["pro: 475", "pro BC"],
    ["starter: 420", "starter AC"],
    ["pro: 1_125", "pro AC"],
  ];
  for (const [needle, label] of expected) {
    if (!econ.includes(needle)) errors.push(`missing ${label}`);
  }
}

export function actionMarginFailuresFromRegistry() {
  const registryPath = path.join(process.cwd(), "src/lib/billing/action-cost-registry.ts");
  if (!fs.existsSync(registryPath)) return ["action-cost-registry missing"];
  const text = fs.readFileSync(registryPath, "utf8");
  if (!text.includes("assertActionRegistryMeetsMarginTarget")) {
    return ["action registry margin assert missing"];
  }
  return [];
}
