#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];

function mustExist(rel) {
  if (!fs.existsSync(path.join(root, rel))) errors.push(`missing ${rel}`);
  else ok.push(rel);
}

function mustInclude(rel, needle, label) {
  const src = fs.readFileSync(path.join(root, rel), "utf8");
  if (!src.includes(needle)) errors.push(`${rel} missing ${label}`);
  else ok.push(`${rel}: ${label}`);
}

[
  "src/lib/competitive/score-categories.ts",
  "src/lib/competitive/dreamos-readiness-score.ts",
  "src/lib/competitive/benchmark-evidence.ts",
  "src/app/api/admin/competitive-score/route.ts",
  "src/components/admin/competitive-score-panel.tsx",
].forEach(mustExist);

const cats = fs.readFileSync(path.join(root, "src/lib/competitive/score-categories.ts"), "utf8");
const matches = cats.match(/id: "/g) ?? [];
if (matches.length !== 40) errors.push(`expected 40 categories, found ${matches.length}`);
else ok.push("40 categories");

mustInclude("scripts/score-competitive-report.mjs", "profit_protection_3x", "credit score unlock");
mustInclude("scripts/score-competitive-report.mjs", "billing_admin_economics", "admin economy unlock");
mustInclude("scripts/lib/dev-server.mjs", "diagnoseDevServer", "dev server probe");

console.log("\n=== verify:competitive-score ===\n");
ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error("✗", m));
process.exit(errors.length ? 1 : 0);
