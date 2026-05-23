#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];

function mustInclude(rel, needle, label) {
  const src = fs.readFileSync(path.join(root, rel), "utf8");
  if (!src.includes(needle)) errors.push(`${rel} missing ${label}`);
  else ok.push(`${rel}: ${label}`);
}

mustInclude("src/components/dev/admin-diagnostics-drawer.tsx", "PostgREST callable", "charge_tokens status label");
mustInclude("src/lib/db/admin-runtime-health.ts", "callableByPostgrest", "postgrest probe");
mustInclude("src/lib/db/probe-charge-tokens-rpc.ts", "stale_postgrest", "diagnosis tree");
mustInclude("supabase/migrations/20260604120000_credit_events_hardening.sql", "credits_consumed", "hardening migration");
mustInclude("scripts/lib/dev-server.mjs", "diagnoseDevServer", "dev server diagnose");
mustInclude("scripts/verify-editor.mjs", "diagnoseDevServer", "editor dev server check");
mustInclude("scripts/credit-billing-sql-patch.sql", "credits_consumed", "sql patch credits_consumed");

console.log("\n=== verify:diagnostics ===\n");
ok.forEach((m) => console.log("✓", m));
errors.forEach((m) => console.error("✗", m));
process.exit(errors.length ? 1 : 0);
