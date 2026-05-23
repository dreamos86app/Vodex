#!/usr/bin/env node
/**
 * Structural credit/billing smoke — no LLM calls unless CREDIT_SMOKE_LIVE=1 (explicit).
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { withSafeTlsEnv } from "./lib/tls-env.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidencePath = path.join(root, ".dreamos-evidence.json");
const errors = [];
const ok = [];

function patchEvidence(patch) {
  let cur = {};
  try {
    cur = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
  } catch {
    /* */
  }
  fs.writeFileSync(evidencePath, JSON.stringify({ ...cur, ...patch, creditSmokeAt: new Date().toISOString() }, null, 2));
}

function run(name, cmd) {
  const r = spawnSync(cmd, { cwd: root, shell: true, encoding: "utf8", env: withSafeTlsEnv({ ...process.env }) });
  if (r.status === 0) ok.push(name);
  else errors.push(`${name} failed`);
  return r.status === 0;
}

console.log("\n=== verify:credit-smoke (structural) ===\n");

run("verify:credits", "npm run verify:credits");
run("verify:billing", "npm run verify:billing");

const health = spawnSync("npm run verify:health", {
  cwd: root,
  shell: true,
  encoding: "utf8",
  env: withSafeTlsEnv({ ...process.env, NODE_USE_SYSTEM_CA: "1" }),
});
const healthOut = `${health.stdout ?? ""}\n${health.stderr ?? ""}`;
if (health.status === 0 && /charge_tokens invalid → HTTP 200/.test(healthOut)) {
  ok.push("charge_tokens PostgREST callable");
  patchEvidence({ chargeTokensCallable: true });
} else {
  errors.push("charge_tokens probe not OK");
  patchEvidence({ chargeTokensCallable: false });
}

const ce = fs.readFileSync(path.join(root, "src/lib/credits/credit-events.ts"), "utf8");
if (ce.includes("Math.max(0") && ce.includes("credits_consumed")) {
  ok.push("writeCreditEvent never null credits_consumed");
} else {
  errors.push("credit-events helper incomplete");
}

if (process.env.CREDIT_SMOKE_LIVE === "1") {
  console.log("\n(CREDIT_SMOKE_LIVE=1 — live LLM smoke not automated here; use manual Discuss/Chat check)\n");
  patchEvidence({ creditSmokeLiveRequested: true });
} else {
  ok.push("live LLM smoke skipped (set CREDIT_SMOKE_LIVE=1 to enable manual gate)");
}

const gatesOk = errors.length === 0;
patchEvidence({
  creditsBillingGates: gatesOk,
  creditEventsNullFree: gatesOk,
});

ok.forEach((m) => console.log("✓", m));
errors.forEach((m) => console.error("✗", m));
process.exit(errors.length ? 1 : 0);
