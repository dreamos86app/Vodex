#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkId = process.argv[2];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function mustInclude(rel, needle, label) {
  if (!read(rel).includes(needle)) throw new Error(`${rel} missing ${label}`);
}

function mustNotInclude(rel, needle, label) {
  if (read(rel).includes(needle)) throw new Error(`${rel} should not contain ${label}`);
}

function mustExist(rel) {
  if (!fs.existsSync(path.join(root, rel))) throw new Error(`missing ${rel}`);
}

const CHECKS = {
  "home-how-it-works-flow": () => {
    mustInclude("src/components/marketing/how-it-works-demo.tsx", 'label: "Describe"', "describe step");
    mustInclude("src/components/marketing/how-it-works-demo.tsx", 'label: "Build"', "build step");
    mustInclude("src/components/marketing/how-it-works-demo.tsx", 'label: "Preview"', "preview step");
    mustInclude("src/components/marketing/how-it-works-demo.tsx", 'label: "Publish"', "publish step");
    mustNotInclude("src/components/marketing/how-it-works-demo.tsx", 'label: "Shape"', "no shape step");
    mustNotInclude("src/components/marketing/how-it-works-demo.tsx", 'label: "Review"', "no review step");
    mustInclude(
      "src/components/marketing/how-it-works-demo.tsx",
      "management food inventory app for my restaurant",
      "restaurant prompt",
    );
    mustNotInclude("src/components/marketing/how-it-works-demo.tsx", "dentist", "no dentist");
    mustInclude("src/components/marketing/how-it-works-demo.tsx", "Pages created", "build summary");
    mustInclude("src/components/marketing/how-it-works-demo.tsx", "getPublicAppRootDomain", "configurable domain");
    mustInclude("src/components/marketing/how-it-works-demo.tsx", "foodflow-inventory", "publish slug");
  },
  "plan-credit-truth": () => {
    mustExist("src/lib/billing/plan-entitlements.ts");
    mustInclude("src/lib/billing/plan-credit-economics.ts", "free: 20", "free 20");
    mustInclude("src/lib/billing/plans.ts", "pro: 500", "pro 500");
    mustInclude("src/lib/credits/canonical-credits.ts", "explicitBonus", "explicit bonus param");
    mustInclude("src/lib/credits/canonical-credits.ts", "sumExplicitBuildGrants", "grant lookup");
    mustNotInclude(
      "src/lib/credits/canonical-credits.ts",
      "available - planAllowance",
      "no inferred bonus from allowance delta",
    );
    mustExist("scripts/repair-plan-credit-bonus.mjs");
    mustInclude("src/lib/credits/normalize-credit-balance.ts", "normalizeAvailableCredits", "runtime credit clamp");
    mustInclude("src/lib/credits/canonical-credits.ts", "repairProfileCreditsIfInflated", "auto repair on read");
    mustInclude("supabase/migrations/20260531120000_align_plan_quotas_with_product.sql", "when 'pro' then 500", "sql pro 500");
  },
  "entitlements-by-plan": () => {
    mustInclude("src/lib/billing/plan-entitlements.ts", "canSelectModel", "model entitlement");
    mustInclude("src/lib/billing/plan-entitlements.ts", "tierAtLeast(id, \"pro\")", "pro unlock");
    mustInclude("src/components/create/workspace/model-picker.tsx", "canSelectModel", "picker uses entitlements");
    mustInclude("src/components/create/workspace/model-picker.tsx", "model-picker-panel", "model side panel");
    mustInclude("src/components/create/workspace/model-picker.tsx", "Coming soon", "deepseek coming soon");
    mustNotInclude("src/components/create/workspace/model-picker.tsx", "credits}c", "no cents-style credit suffix");
    mustInclude("src/components/create/workspace/publish-modal.tsx", "getEntitlements", "publish uses entitlements");
  },
  "admin-plan-filters": () => {
    mustInclude("src/components/admin/admin-users-panel.tsx", "planFilter", "plan filter state");
    mustInclude("src/components/admin/admin-users-panel.tsx", "PlanBadge", "plan badge in admin");
    mustInclude("src/components/billing/plan-badge.tsx", "plan-badge-", "badge test id");
  },
  "no-framework-labels-public-ui": () => {
    mustInclude("src/lib/projects/user-safe-project-badges.ts", 'mode?: "user"', "user-safe badges");
    mustNotInclude("src/components/marketing/how-it-works-demo.tsx", "nextjs", "no nextjs in showcase");
    mustNotInclude("src/components/os-home/your-apps-section.tsx", "framework", "no framework on home cards");
    mustNotInclude("src/components/builder/app-builder-workspace.tsx", "DeployWorkspacePanel", "no advanced deploy panel");
  },
};

if (!checkId || !CHECKS[checkId]) {
  console.error(`Usage: node scripts/verify-p0-home-showcase.mjs <${Object.keys(CHECKS).join("|")}>`);
  process.exit(1);
}

console.log(`\n=== verify:${checkId} ===\n`);
try {
  CHECKS[checkId]();
  console.log("✓", checkId);
} catch (e) {
  console.error("✗", e instanceof Error ? e.message : e);
  process.exit(1);
}
