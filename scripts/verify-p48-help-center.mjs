#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { P48_CHECKS } from "./lib/p48-verify-checks.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;

for (const id of Object.keys(P48_CHECKS)) {
  const errors = P48_CHECKS[id](root);
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

const total = Object.keys(P48_CHECKS).length + 1;
const score = Math.round(((total - failed) / total) * 100);
console.log(`\nP4.8 help center score: ${score}/100 (${failed} blockers)`);
process.exit(failed ? 1 : 0);
