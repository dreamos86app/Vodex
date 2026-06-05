#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory() && ent.name !== "node_modules" && ent.name !== ".next") walk(p, acc);
    else if (/\.(tsx?|mjs)$/.test(ent.name)) acc.push(p);
  }
  return acc;
}

const EXPECTED = {
  free: { build: 20, action: 20 },
  starter: { build: 185, action: 420 },
  pro: { build: 475, action: 1125 },
  infinity: { build: 975, action: 2350 },
};

const econ = read("src/lib/billing/plan-credit-economics.ts");
for (const [plan, v] of Object.entries(EXPECTED)) {
  if (!new RegExp(`${plan}:\\s*${v.action}|${plan}:\\s*${v.action >= 1000 ? `${Math.floor(v.action / 1000)}_${String(v.action % 1000).padStart(3, "0")}` : v.action}`).test(econ)) {
    errors.push(`economics: ${plan} action ${v.action}`);
  }
  const buildUnderscore =
    v.build >= 1000 ? `${Math.floor(v.build / 1000)}_${String(v.build % 1000).padStart(3, "0")}` : String(v.build);
  if (!new RegExp(`${plan}:\\s*(${v.build}|${buildUnderscore})`).test(econ)) {
    errors.push(`economics: ${plan} build ${v.build}`);
  }
}
ok.push("central economics constants");

const stalePatterns = [
  /pro:\s*2000/i,
  /pro:\s*2_000/i,
  /infinity:\s*10000/i,
  /infinity:\s*10_000/i,
  /infinity:\s*5000/i,
  /business:\s*5000/i,
  /credits:\s*10_000.*pro/i,
  /Pro.*2,000 Action/i,
  /10,000.*Action Credit/i,
];

const uiRoots = [
  path.join(root, "src/components"),
  path.join(root, "src/app"),
  path.join(root, "src/lib/docs.ts"),
].flatMap((r) => (fs.existsSync(r) && fs.statSync(r).isDirectory() ? walk(r) : fs.existsSync(r) ? [r] : []));

for (const file of uiRoots) {
  const rel = path.relative(root, file).replace(/\\/g, "/");
  if (rel.includes("plan-credit-economics") || rel.includes("verify-plan-credit")) continue;
  const text = fs.readFileSync(file, "utf8");
  for (const pat of stalePatterns) {
    if (pat.test(text)) errors.push(`stale pattern ${pat} in ${rel}`);
  }
}

const mustHave = [
  ["src/components/pricing/pricing-view.tsx", "planPricingCardCopy"],
  ["src/lib/billing/plan-entitlements.ts", "monthlyActionCreditsForPlan"],
  ["src/app/api/credits/route.ts", "monthlyActionCreditsForPlan"],
  ["src/components/credits/credits-tracker.tsx", "monthlyActionCreditsForPlan"],
  ["src/components/chat/credits-upgrade-modal.tsx", "getCreditAllowance"],
];
for (const [rel, needle] of mustHave) {
  if (!read(rel).includes(needle)) errors.push(`${rel} missing ${needle}`);
  else ok.push(rel);
}

console.log("\n=== verify:plan-credit-ui-consistency ===\n");
ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
process.exit(errors.length ? 1 : 0);
