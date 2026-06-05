#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const steps = [
  "typecheck",
  "verify:p53-unit-economics",
  "verify:p53-credit-pricing",
  "verify:p52-production",
];

let failed = 0;
for (const step of steps) {
  const r = spawnSync("npm", ["run", step], {
    cwd: root,
    shell: true,
    encoding: "utf8",
    env: { ...process.env, NODE_OPTIONS: "" },
  });
  if (r.status !== 0) {
    failed += 1;
    console.error(`✗ ${step}`);
    if (r.stderr) process.stderr.write(r.stderr.slice(0, 2000));
  } else {
    console.log(`✓ ${step}`);
  }
}

const score = Math.round(((steps.length - failed) / steps.length) * 100);
console.log(`\nP5.3 production score: ${score}/100 (${failed} failed)`);
process.exit(failed ? 1 : 0);
