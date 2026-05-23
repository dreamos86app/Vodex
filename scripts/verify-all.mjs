#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withSafeTlsEnv } from "./lib/tls-env.mjs";
import { writeEvidence } from "./lib/e2e-live.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const verifyEnv = withSafeTlsEnv({ ...process.env });
// verify:all is structure + build gate — never inherit live flags from the shell
delete verifyEnv.E2E_RUN_LIVE;
delete verifyEnv.BENCHMARK_LIVE;

const steps = [
  ["verify:tls", "npm run verify:tls"],
  ["verify:env-safety", "npm run verify:env-safety"],
  ["verify:public-copy", "npm run verify:public-copy"],
  ["verify:changelog", "npm run verify:changelog"],
  ["verify:storage", "npm run verify:storage"],
  ["verify:app-files-schema", "npm run verify:app-files-schema"],
  ["verify:billing", "npm run verify:billing"],
  ["verify:credits", "npm run verify:credits"],
  ["verify:admin-credit-economy", "npm run verify:admin-credit-economy"],
  ["verify:diagnostics", "npm run verify:diagnostics"],
  ["verify:chat", "npm run verify:chat"],
  ["verify:generation", "npm run verify:generation"],
  ["verify:blueprint", "npm run verify:blueprint"],
  ["verify:templates", "npm run verify:templates"],
  ["verify:backend-generation", "npm run verify:backend-generation"],
  ["verify:database-depth", "npm run verify:database-depth"],
  ["verify:zip-import", "npm run verify:zip-import"],
  ["verify:zip-import-live-route", "npm run verify:zip-import-live-route"],
  ["verify:deploy", "npm run verify:deploy"],
  ["verify:auth", "npm run verify:auth"],
  ["verify:credit-economy-db", "npm run verify:credit-economy-db"],
  ["verify:builder-db", "npm run verify:builder-db"],
  ["verify:wiring", "npm run verify:wiring"],
  ["verify:repair", "npm run verify:repair"],
  ["verify:create-flow", "npm run verify:create-flow"],
  ["verify:project-lifecycle", "npm run verify:project-lifecycle"],
  ["verify:publish", "npm run verify:publish"],
  ["verify:intent-gate", "npm run verify:intent-gate"],
  ["verify:model-cost-optimizer", "npm run verify:model-cost-optimizer"],
  ["verify:ids", "npm run verify:ids"],
  ["verify:competitive-score", "npm run verify:competitive-score"],
  ["verify:navigation", "npm run verify:navigation"],
  ["verify:performance", "npm run verify:performance"],
  ["verify:public-landing", "npm run verify:public-landing"],
  ["verify:e2e", "npm run verify:e2e"],
  ["verify:preview", "npm run verify:preview"],
  ["verify:production-hardening", "npm run verify:production-hardening"],
  ["verify:security", "npm run verify:security"],
  ["verify:rls", "npm run verify:rls"],
  ["verify:no-secrets-client", "npm run verify:no-secrets-client"],
  ["verify:rate-limits", "npm run verify:rate-limits"],
  ["verify:mutation-guards", "npm run verify:mutation-guards"],
  ["verify:audit-logs", "npm run verify:audit-logs"],
  ["verify:ui-quality", "npm run verify:ui-quality"],
  ["verify:preview-providers", "npm run verify:preview-providers"],
  ["verify:mobile-layout", "npm run verify:mobile-layout"],
  ["verify:editor", "npm run verify:editor"],
  ["verify:dns-wildcard", "npm run verify:dns-wildcard"],
  ["benchmark:smoke", "npm run benchmark:smoke"],
  ["benchmark:half", "npm run benchmark:half"],
  ["benchmark:score", "npm run benchmark:score"],
  ["verify:benchmark-evidence", "npm run verify:benchmark-evidence"],
  ["typecheck", "npm run typecheck"],
  ["build", "npm run build"],
  ["verify:health", "npm run verify:health"],
];

let failed = false;
for (const [name, cmd] of steps) {
  console.log(`\n--- ${name} ---\n`);
  const r = spawnSync(cmd, { cwd: root, shell: true, stdio: "inherit", env: verifyEnv });
  if (r.status !== 0) {
    console.error(`\n✗ ${name} failed\n`);
    if (name === "verify:credit-economy-db" || name === "verify:tls") {
      console.error("If this was a TLS error, run: npm run verify:tls");
      console.error('Safe fix (PowerShell): $env:NODE_USE_SYSTEM_CA="1"\n');
    }
    failed = true;
    break;
  }
}
if (!failed) {
  writeEvidence({ verifyPassed: true });
}
process.exit(failed ? 1 : 0);
