#!/usr/bin/env node
/**
 * VODEX P3.9 — production readiness orchestrator.
 * Runs all P3.9 verify:* suites and prints a 0–100 readiness score.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const phases = [
  { id: "mobile-pipeline", script: "verify:mobile-build-pipeline", weight: 8, category: "Mobile" },
  { id: "apk", script: "verify:apk-generation", weight: 5, category: "Mobile" },
  { id: "aab", script: "verify:aab-generation", weight: 5, category: "Mobile" },
  { id: "ios", script: "verify:ios-package-generation", weight: 5, category: "Mobile" },
  { id: "readiness", script: "verify:readiness-engine", weight: 8, category: "Readiness" },
  { id: "store-wizard", script: "verify:store-onboarding", weight: 6, category: "Stores" },
  { id: "sha", script: "verify:sha-management-advanced", weight: 5, category: "Stores" },
  { id: "revenuecat", script: "verify:revenuecat-audit", weight: 6, category: "Billing" },
  { id: "zip-stress", script: "verify:zip-stress-suite", weight: 7, category: "Preview" },
  { id: "worker-chaos", script: "verify:preview-worker-chaos", weight: 7, category: "Preview" },
  { id: "publish-health", script: "verify:publish-health", weight: 7, category: "Publish" },
  { id: "notifications", script: "verify:notifications-certification", weight: 6, category: "Comms" },
  { id: "email", script: "verify:email-certification", weight: 5, category: "Comms" },
  { id: "billing", script: "verify:billing-certification", weight: 7, category: "Billing" },
  { id: "staging-e2e", script: "verify:staging-e2e", weight: 6, category: "E2E" },
  { id: "admin-ops", script: "verify:admin-operations-center", weight: 4, category: "Admin" },
  { id: "p38-regression", script: "verify:p38-production", weight: 8, category: "Regression" },
];

const results = [];
let score = 0;
let maxScore = 0;
const blockers = [];

for (const phase of phases) {
  maxScore += phase.weight;
  const r = spawnSync("npm", ["run", phase.script], { cwd: root, shell: true, encoding: "utf8" });
  const ok = r.status === 0;
  if (ok) score += phase.weight;
  else {
    blockers.push({ id: phase.id, script: phase.script, category: phase.category });
  }
  results.push({ ...phase, ok });
  console.log(ok ? `✓ ${phase.script}` : `✗ ${phase.script} FAILED`);
}

const pct = maxScore ? Math.round((score / maxScore) * 100) : 0;
const byCategory = {};
for (const r of results) {
  if (!byCategory[r.category]) byCategory[r.category] = { passed: 0, total: 0, weight: 0, earned: 0 };
  byCategory[r.category].total += 1;
  byCategory[r.category].weight += r.weight;
  if (r.ok) {
    byCategory[r.category].passed += 1;
    byCategory[r.category].earned += r.weight;
  }
}

console.log("\n── P3.9 Production Readiness ──");
console.log(`Score: ${pct}/100 (${score}/${maxScore} weighted points)`);
console.log("\nCategory breakdown:");
for (const [cat, v] of Object.entries(byCategory)) {
  const catPct = v.weight ? Math.round((v.earned / v.weight) * 100) : 0;
  console.log(`  ${cat}: ${catPct}% (${v.passed}/${v.total} suites)`);
}
if (blockers.length) {
  console.log("\nRemaining blockers:");
  for (const b of blockers) {
    console.log(`  - [${b.category}] ${b.script}`);
  }
}
console.log("\nManual QA: run `npm run typecheck`, `npm run build`, staging Playwright with PLAYWRIGHT_BASE_URL.");
process.exit(blockers.length ? 1 : 0);
