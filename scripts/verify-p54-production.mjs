#!/usr/bin/env node
/**
 * @deprecated P5.4 superseded by P5.4.3 — use verify:p543-credit-economy + audit:profit-forecast
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

console.warn("⚠ verify:p54-production is deprecated — running P5.4.3 checks instead\n");

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const steps = ["verify:p543-credit-economy", "audit:profit-forecast", "audit:action-costs"];
let failed = 0;
for (const step of steps) {
  const r = spawnSync("npm", ["run", step], { cwd: root, shell: true, encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } });
  if (r.status !== 0) {
    failed += 1;
    console.error(`✗ ${step}`);
  } else {
    console.log(`✓ ${step}`);
  }
}
process.exit(failed ? 1 : 0);
