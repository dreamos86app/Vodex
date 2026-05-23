#!/usr/bin/env node
/**
 * Probes credit economy tables on canonical Supabase project.
 * Requires .env.local with service role + URL for wciioegiczwqlmlroley.
 * TLS: uses NODE_USE_SYSTEM_CA=1 (safe). Never disables TLS verification.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isTlsRejectDisabled,
  isTlsFetchError,
  printTlsFix,
  safeFetch,
} from "./lib/tls-env.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const p = join(root, ".env.local");
  if (!existsSync(p)) return {};
  const out = {};
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

const env = { ...process.env, ...loadEnv() };
const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const sr = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY ?? "";

const errors = [];
const ok = [];

if (!url.includes("wciioegiczwqlmlroley")) {
  errors.push("NEXT_PUBLIC_SUPABASE_URL must be wciioegiczwqlmlroley");
}
if (!sr) errors.push("SUPABASE_SERVICE_ROLE_KEY missing — cannot probe tables");

if (isTlsRejectDisabled()) {
  errors.push(
    "NODE_TLS_REJECT_UNAUTHORIZED=0 is set — remove from OS env (dangerous). Use NODE_USE_SYSTEM_CA=1 instead.",
  );
}

async function probeTable(table, migrationHint, optional = false) {
  if (!url || !sr) return;
  let res;
  try {
    res = await safeFetch(`${url}/rest/v1/${table}?select=id&limit=1`, {
      headers: {
        apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? sr,
        Authorization: `Bearer ${sr}`,
      },
    });
  } catch (err) {
    if (isTlsFetchError(err)) {
      errors.push(`TLS certificate error probing public.${table} — not a missing table`);
      printTlsFix(url);
      return "tls_abort";
    }
    errors.push(`Network error probing public.${table}: ${String(err?.message ?? err)}`);
    return;
  }

  if (res.status === 404 || res.status === 406) {
    (optional ? ok : errors).push(
      optional
        ? `warn: Table public.${table} missing (optional) — ${migrationHint}`
        : `Table public.${table} missing — ${migrationHint}`,
    );
  } else if (res.ok || res.status === 200 || res.status === 403) {
    ok.push(`Table public.${table} reachable (HTTP ${res.status})`);
  } else {
    const body = await res.text();
    if (body.includes("PGRST205") || body.includes("does not exist")) {
      (optional ? ok : errors).push(
        optional
          ? `warn: Table public.${table} missing (optional) — ${migrationHint}`
          : `Table public.${table} missing — ${migrationHint}`,
      );
    } else {
      ok.push(`Table public.${table} HTTP ${res.status}`);
    }
  }
}

const CREDIT_MIGRATION =
  "Run supabase/migrations/20260603120000_credit_economy_tables.sql on project wciioegiczwqlmlroley.";
const BUILDER_MIGRATION =
  "Run supabase/migrations/20260605120000_builder_workspace_tables.sql on project wciioegiczwqlmlroley.";
const PUBLISHED_MIGRATION =
  "Run supabase/migrations/20260606120000_published_apps.sql on project wciioegiczwqlmlroley.";

const tables = [
  { name: "credit_quotes", hint: CREDIT_MIGRATION },
  { name: "credit_reservations", hint: CREDIT_MIGRATION },
  { name: "generation_cost_audits", hint: CREDIT_MIGRATION },
  { name: "provider_usage_logs", hint: CREDIT_MIGRATION },
  { name: "pending_diffs", hint: BUILDER_MIGRATION },
  { name: "project_deployments", hint: BUILDER_MIGRATION },
  { name: "published_apps", hint: PUBLISHED_MIGRATION },
];

for (const t of tables) {
  const result = await probeTable(t.name, t.hint, t.optional);
  if (result === "tls_abort") break;
}

console.log("\n=== verify:credit-economy-db ===\n");
ok.forEach((m) => console.log("✓", m));

const tlsOnly = errors.length > 0 && errors.every((e) => e.includes("TLS certificate"));
if (errors.length) {
  if (tlsOnly) {
    console.error("\n✗ verify:credit-economy-db failed: TLS certificate verification\n");
    console.error("This is NOT a missing migration. Run: npm run verify:tls\n");
  } else {
    errors.forEach((m) => console.error("✗", m));
  }
  process.exit(1);
}
console.log(`\n${ok.length} checks passed.\n`);
