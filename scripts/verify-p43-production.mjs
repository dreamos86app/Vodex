#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { P43_CHECKS } from "./lib/p43-verify-checks.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;

for (const id of Object.keys(P43_CHECKS)) {
  const errors = P43_CHECKS[id](root);
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
  if (r1.stdout) console.error(r1.stdout.slice(-2000));
  if (r1.stderr) console.error(r1.stderr.slice(-2000));
}

const r2 = spawnSync("npm", ["run", "build"], { cwd: root, shell: true, encoding: "utf8", env: { ...process.env, CI: "1" } });
if (r2.status !== 0) {
  failed += 1;
  console.error("✗ build");
}

const total = Object.keys(P43_CHECKS).length + 2;
const score = Math.round(((total - failed) / total) * 100);
console.log(`\nP4.3 production score: ${score}/100 (${failed} blockers)`);
process.exit(failed ? 1 : 0);
