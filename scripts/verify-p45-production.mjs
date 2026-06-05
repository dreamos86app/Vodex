#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { P45_CHECKS } from "./lib/p45-verify-checks.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;

for (const id of Object.keys(P45_CHECKS)) {
  const errors = P45_CHECKS[id](root);
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

const r2 = spawnSync("npm", ["run", "build"], { cwd: root, shell: true, encoding: "utf8", env: { ...process.env, CI: "1" } });
if (r2.status !== 0) {
  failed += 1;
  console.error("✗ build");
}

const total = Object.keys(P45_CHECKS).length + 2;
const score = Math.round(((total - failed) / total) * 100);
console.log(`\nP4.5 production score: ${score}/100 (${failed} blockers)`);
process.exit(failed ? 1 : 0);
