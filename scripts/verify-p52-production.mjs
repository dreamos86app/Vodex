#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const steps = [
  "typecheck",
  "build",
  "verify:p52-mobile-ui",
  "verify:p52-credit-truth",
  "verify:p52-credit-reset",
  "verify:p52-action-credit-spending",
  "verify:p52-notification-realtime",
  "verify:p52-presence",
  "verify:p52-version-history",
  "verify:p52-workspace-audit",
  "verify:p52-chat-persistence",
  "verify:p52-unit-economics",
  "verify:p51-certification-blockers",
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
console.log(`\nP5.2 production score: ${score}/100 (${failed} failed)`);
process.exit(failed ? 1 : 0);
