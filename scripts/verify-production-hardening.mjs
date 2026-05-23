#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withSafeTlsEnv } from "./lib/tls-env.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const verifyEnv = withSafeTlsEnv(process.env);

const steps = [
  "verify:security",
  "verify:rls",
  "verify:no-secrets-client",
  "verify:rate-limits",
  "verify:mutation-guards",
  "verify:audit-logs",
  "verify:env-safety",
  "verify:tls",
];

let failed = false;
console.log("\n=== verify:production-hardening ===\n");

for (const name of steps) {
  console.log(`--- ${name} ---`);
  const r = spawnSync(`npm run ${name}`, { cwd: root, shell: true, stdio: "inherit", env: verifyEnv });
  if (r.status !== 0) {
    console.error(`\n✗ ${name} failed\n`);
    failed = true;
    break;
  }
}

if (!failed) {
  console.log("\n✓ All production hardening checks passed\n");
  try {
    const evidencePath = path.join(root, ".dreamos-evidence.json");
    let cur = {};
    if (fs.existsSync(evidencePath)) {
      cur = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
    }
    fs.writeFileSync(
      evidencePath,
      JSON.stringify({ ...cur, securityVerifyPassed: true }, null, 2),
    );
  } catch {
    /* non-fatal */
  }
}
process.exit(failed ? 1 : 0);
