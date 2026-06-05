#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CHECKS } from "./lib/p42-verify-checks.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const scripts = Object.keys(CHECKS).map((id) => `verify:${id}`);
let failed = 0;

for (const id of Object.keys(CHECKS)) {
  const errors = CHECKS[id](root);
  if (errors.length) {
    failed += 1;
    console.error(`✗ verify:${id}`, errors[0]);
  } else {
    console.log(`✓ verify:${id}`);
  }
}

const r1 = spawnSync("npm", ["run", "typecheck"], { cwd: root, shell: true, encoding: "utf8" });
if (r1.status !== 0) {
  failed += 1;
  console.error("✗ typecheck");
}

const score = Math.round(((Object.keys(CHECKS).length - failed) / (Object.keys(CHECKS).length + 1)) * 100);
console.log(`\nP4.2 script score: ${score}/100 (${failed} blockers)`);
process.exit(failed ? 1 : 0);
