#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { P50_CHECKS } from "./lib/p50-verify-checks.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;

for (const id of Object.keys(P50_CHECKS)) {
  const errors = P50_CHECKS[id](root);
  if (errors.length) {
    failed += 1;
    console.error(`✗ ${id}`, errors[0]);
  } else {
    console.log(`✓ ${id}`);
  }
}

const r1 = spawnSync("npm", ["run", "typecheck"], { cwd: root, shell: true, encoding: "utf8" });
if (r1.status !== 0) {
  failed += 1;
  console.error("✗ typecheck");
}

const r2 = spawnSync("npm", ["run", "verify:p49-certification"], { cwd: root, shell: true, encoding: "utf8" });
if (r2.status !== 0) {
  failed += 1;
  console.error("✗ verify:p49-certification");
}

const total = Object.keys(P50_CHECKS).length + 2;
const score = Math.round(((total - failed) / total) * 100);
console.log(`\nP5.0 certification blocker fix score: ${score}/100 (${failed} blockers)`);
process.exit(failed ? 1 : 0);
