#!/usr/bin/env node
/**
 * Fast deterministic checks only — no benchmarks, no live E2E, no build.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withSafeTlsEnv } from "./lib/tls-env.mjs";
import { runStep, formatElapsed } from "./lib/verify-runner.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const verifyEnv = withSafeTlsEnv({ ...process.env });
delete verifyEnv.E2E_RUN_LIVE;
delete verifyEnv.BENCHMARK_LIVE;

const steps = [
  ["typecheck", "npm run typecheck"],
  ["verify:auth-session", "npm run verify:auth-session"],
  ["verify:credit-display", "npm run verify:credit-display"],
  ["verify:app-icons", "npm run verify:app-icons"],
  ["verify:project-banners", "npm run verify:project-banners"],
  ["verify:project-cards", "npm run verify:project-cards"],
  ["verify:public-stats", "npm run verify:public-stats"],
  ["verify:home-page", "npm run verify:home-page"],
  ["verify:route-stability", "npm run verify:route-stability"],
  ["verify:navigation", "npm run verify:navigation"],
];

console.log("\n=== verify:fast ===");
console.log(`[verify] ${steps.length} quick steps (no dev server, no build, no benchmarks)\n`);

const suiteStart = Date.now();
let failed = false;

for (const [name, cmd] of steps) {
  const r = await runStep(name, cmd, { cwd: root, env: verifyEnv });
  if (r.status !== 0) {
    failed = true;
    break;
  }
}

console.log(`\n=== verify:fast ${failed ? "FAILED" : "PASSED"} in ${formatElapsed(Date.now() - suiteStart)} ===\n`);
process.exit(failed ? 1 : 0);
