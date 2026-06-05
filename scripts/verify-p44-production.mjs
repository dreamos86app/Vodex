#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { P44_CHECKS } from "./lib/p44-verify-checks.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;

for (const id of Object.keys(P44_CHECKS)) {
  const errors = P44_CHECKS[id](root);
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

const r2 = spawnSync("npm", ["run", "build"], { cwd: root, shell: true, encoding: "utf8", env: { ...process.env, CI: "1" } });
if (r2.status !== 0) {
  failed += 1;
  console.error("✗ build");
}

const total = Object.keys(P44_CHECKS).length + 2;
const score = Math.round(((total - failed) / total) * 100);
console.log(`\nP4.4 production score: ${score}/100 (${failed} blockers)`);
process.exit(failed ? 1 : 0);
