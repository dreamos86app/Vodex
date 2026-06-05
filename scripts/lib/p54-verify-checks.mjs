import fs from "node:fs";
import path from "node:path";
import { createChecker } from "./p42-verify-checks.mjs";
import {
  compareEconomics,
  DEFAULT_ASSUMPTIONS,
  TARGET_GROSS_MARGIN_PERCENT,
  MIN_MAX_BURN_MARGIN_PERCENT,
  MIN_ACTION_MARGIN_MULTIPLIER,
  planMaxBurnMargin,
} from "./unit-economics-model.mjs";
import { auditAllActions } from "./action-cost-audit.mjs";

export const P54_UNIT_ECONOMICS = (root) => {
  const errors = [];
  const report = compareEconomics(DEFAULT_ASSUMPTIONS);
  const blendedRounded = Math.round(report.newGrossMarginPct * 10) / 10;
  if (blendedRounded < TARGET_GROSS_MARGIN_PERCENT) {
    errors.push(
      `blended gross margin ${blendedRounded.toFixed(1)}% < ${TARGET_GROSS_MARGIN_PERCENT}%`,
    );
  }
  for (const plan of [
    "starter",
    "pro",
    "infinity_i",
    "infinity_ii",
    "infinity_iii",
    "infinity_iv",
    "infinity_v",
    "infinity_vi",
    "infinity_vii",
  ]) {
    const m = planMaxBurnMargin(plan, DEFAULT_ASSUMPTIONS);
    if (m < MIN_MAX_BURN_MARGIN_PERCENT - 0.5) {
      errors.push(`${plan} max-burn margin ${m.toFixed(1)}% < ${MIN_MAX_BURN_MARGIN_PERCENT}%`);
    }
  }
  const auditPath = path.join(root, "scripts/audit-unit-economics.mjs");
  if (!fs.existsSync(auditPath)) errors.push("audit-unit-economics.mjs missing");
  return errors;
};

export const P54_ACTION_COST_AUDIT = (root) => {
  const errors = [];
  if (!fs.existsSync(path.join(root, "scripts/audit-action-costs.mjs"))) {
    errors.push("audit-action-costs.mjs missing");
  }
  const failed = auditAllActions().filter((r) => !r.pass && r.totalCost > 0);
  if (failed.length) {
    errors.push(`${failed.length} actions below 5x margin in audit catalog`);
  }
  return errors;
};

export const P54_CREDIT_ECONOMY = (root) => {
  const { errors, must, mustExist } = createChecker(root);
  mustExist("src/lib/billing/profit-guard.ts", "profit-guard");
  must("src/lib/billing/profit-guard.ts", "MIN_MARGIN_MULTIPLIER = 5", "profit guard 5x");
  must("src/lib/billing/plan-credit-economics.ts", "free: 20", "free 20 BC");
  must("src/lib/billing/plan-credit-economics.ts", "starter: 150", "starter 150 BC");
  must("src/lib/billing/plan-credit-economics.ts", "starter: 500", "starter 500 AC");
  must("src/lib/billing/plan-credit-economics.ts", "pro: 375", "pro 375 BC");
  must("src/lib/billing/plan-credit-economics.ts", "pro: 1_250", "pro 1250 AC");
  must("src/lib/billing/billing-constants.ts", "ACTION_CREDITS_PER_DOLLAR = 25", "25 AC/$");
  must("src/components/chat/chat-view.tsx", "DISCUSS_MODEL_AUTO", "no discuss model picker");
  must("src/lib/ai/discuss-mode-policy.ts", "pickCheapestSafeDiscussModel", "cheapest discuss");
  const econ = fs.readFileSync(path.join(root, "src/lib/billing/plan-credit-economics.ts"), "utf8");
  const stale = [
    ["starter: 185", "stale P5.3 starter BC"],
    ["starter: 420", "stale P5.3 starter AC"],
    ["pro: 475", "stale P5.3 pro BC"],
    ["pro: 1_125", "stale P5.3 pro AC"],
  ];
  for (const [needle, label] of stale) {
    if (econ.includes(needle)) errors.push(label);
  }
  const ratio = 500 / 20;
  if (Math.abs(ratio - 25) > 0.01) errors.push("starter AC/$ ratio not 25");
  return errors;
};

export const P54_PROFIT_GUARD = (root) => {
  const errors = [];
  const registry = path.join(root, "src/lib/billing/action-cost-registry.ts");
  if (!fs.existsSync(registry)) errors.push("action-cost-registry missing");
  else {
    const text = fs.readFileSync(registry, "utf8");
    if (!text.includes("assertActionRegistryMeetsMarginTarget")) {
      errors.push("registry margin assert missing");
    }
  }
  const media = path.join(root, "src/lib/media/dreamos-media-router.ts");
  if (fs.existsSync(media)) {
    const t = fs.readFileSync(media, "utf8");
    if (t.includes("image_premium") && t.match(/default.*image_premium/i)) {
      errors.push("image defaults to premium");
    }
  }
  return errors;
};

export { MIN_ACTION_MARGIN_MULTIPLIER };
