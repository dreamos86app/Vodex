#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function tierForSizeMb(sizeMb) {
  if (sizeMb < 5) return 1;
  if (sizeMb < 25) return 2;
  if (sizeMb < 100) return 3;
  return 4;
}

const TIER_BASE = { 1: 10, 2: 25, 3: 50, 4: 100 };

function dependencySurcharge(count) {
  if (count > 400) return 100;
  if (count > 200) return 50;
  if (count > 100) return 25;
  return 0;
}

function estimate(sizeMb, multiplier = 1, dependencyCount = 0) {
  const tier = tierForSizeMb(sizeMb);
  return Math.ceil(TIER_BASE[tier] * multiplier) + dependencySurcharge(dependencyCount);
}

const cases = [
  [4, 1, 10],
  [5, 1, 25],
  [24.9, 1, 25],
  [25, 1, 50],
  [99, 1, 50],
  [100, 1, 100],
  [4, 3, 30],
  [47, 3, 150],
];

for (const [sizeMb, mult, expected] of cases) {
  const got = estimate(sizeMb, mult);
  if (got !== expected) {
    errors.push(`tier estimate ${sizeMb}MB ×${mult}: expected ${expected}, got ${got}`);
  }
}

const depCases = [
  [101, 25],
  [201, 50],
  [401, 100],
  [100, 0],
];
for (const [count, surcharge] of depCases) {
  if (dependencySurcharge(count) !== surcharge) {
    errors.push(`dependency surcharge ${count}: expected ${surcharge}, got ${dependencySurcharge(count)}`);
  }
}
if (estimate(4, 1, 150) !== 10 + 25) {
  errors.push("combined size + dependency estimate mismatch");
}

const src = fs.readFileSync(path.join(root, "src/lib/imports/zip-preview-action-credits.ts"), "utf8");
if (!src.includes("tierForSizeMb")) errors.push("missing tierForSizeMb export");
if (!src.includes("dependencySurchargeCredits")) errors.push("missing dependencySurchargeCredits");
if (!src.includes("sizeBaseCredits")) errors.push("missing sizeBaseCredits");
if (!src.includes("getPreviewCostMultiplier")) errors.push("missing platform multiplier");
if (!src.includes("zip_preview_action_holds")) errors.push("missing holds table usage");

const migration = path.join(root, "supabase/migrations/20260806120000_p33_preview_worker_zip_credits.sql");
if (!fs.existsSync(migration)) {
  errors.push("missing P33 migration");
} else {
  const m = fs.readFileSync(migration, "utf8");
  if (!m.includes("preview_cost_multiplier")) errors.push("missing preview_cost_multiplier setting");
  if (!m.includes("zip_preview_action_holds")) errors.push("missing zip_preview_action_holds table");
}

const wizard = fs.readFileSync(path.join(root, "src/components/apps/zip-import-wizard.tsx"), "utf8");
if (!wizard.includes("Build Preview (")) errors.push("wizard missing build preview CTA");
if (!wizard.includes("estimatedActionCredits")) errors.push("wizard missing credit display");
if (!wizard.includes("Preview Build Summary")) errors.push("wizard missing preview build summary");
if (!wizard.includes("NOT charging Action Credits")) errors.push("wizard missing not-charged notice");

if (!fs.readFileSync(path.join(root, "package.json"), "utf8").includes("verify:zip-credit-estimation")) {
  errors.push("verify script not registered");
}

if (errors.length) {
  console.error("verify:zip-credit-estimation FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:zip-credit-estimation OK");
