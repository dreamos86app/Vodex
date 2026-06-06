#!/usr/bin/env node
/**
 * npm run setup:e2e-credits — grant E2E test user build + action credits (never production).
 * Requires E2E_ALLOW_CREDIT_GRANT=1 or non-production NODE_ENV.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { allowE2eCreditPrepare } from "./lib/e2e-credit-thresholds.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

if (!allowE2eCreditPrepare(process.env) && process.env.E2E_ALLOW_CREDIT_GRANT !== "1") {
  console.error(
    "✗ setup:e2e-credits blocked — set E2E_RUN_LIVE=1 or E2E_ALLOW_CREDIT_GRANT=1 for intentional grants",
  );
  process.exit(1);
}

const r = spawnSync("npm", ["run", "e2e:credits:prepare"], {
  cwd: root,
  shell: true,
  stdio: "inherit",
  env: { ...process.env, E2E_RUN_LIVE: process.env.E2E_RUN_LIVE ?? "1" },
});
process.exit(r.status ?? 1);
