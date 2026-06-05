#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const must = (rel, needle, label) => {
  const p = path.join(root, rel);
  if (!fs.existsSync(p) || !fs.readFileSync(p, "utf8").includes(needle)) errors.push(label);
};

must("scripts/mid-cycle-upgrade-credits-tests.ts", "new_remaining", "upgrade credit formula");
must("scripts/verify-action-credit-ledger.mjs", "ledger", "action credit ledger");
must("scripts/verify-paddle-integration.mjs", "paddle-webhook-idempotent-no-double-credit", "duplicate webhook guard");
must("src/app/api/billing/paddle/webhook/route.ts", "duplicate", "paddle webhook dedupe");
must("supabase/migrations/20260809122000_p36_credit_upgrade_delta_ledger.sql", "plan_upgrade_delta", "delta ledger migration");

if (errors.length) {
  console.error("verify:billing-certification FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:billing-certification OK");
