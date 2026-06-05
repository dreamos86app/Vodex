#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const suites = [
  "verify:mobile-gate",
  "verify:mobile-wrapper-config",
  "verify:mobile-publishing-flow",
  "verify:announcements",
  "verify:sha-management",
  "verify:splash-generation",
  "verify:mobile-artifacts",
  "verify:web-publish-flow",
  "verify:first-build-renderable",
  "verify:route-discovery",
  "verify:credit-upgrade-examples",
  "verify:action-credit-ledger",
  "verify:credit-display-consistency",
  "verify:notification-e2e",
  "verify:preview-worker-resilience",
];

let failed = false;
for (const name of suites) {
  const r = spawnSync("npm", ["run", name], { cwd: root, shell: true, encoding: "utf8" });
  if (r.status === 0) {
    console.log(`${name} OK`);
  } else {
    failed = true;
    console.error(`${name} FAILED`);
    if (r.stdout) console.error(r.stdout.slice(0, 2000));
    if (r.stderr) console.error(r.stderr.slice(0, 2000));
  }
}

process.exit(failed ? 1 : 0);
