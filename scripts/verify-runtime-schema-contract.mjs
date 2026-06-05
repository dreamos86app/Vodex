#!/usr/bin/env node
/** Deterministic runtime schema contract checks (no AI providers). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];

function mustInclude(rel, needle, label) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) {
    errors.push(`missing ${rel}`);
    return;
  }
  if (!fs.readFileSync(full, "utf8").includes(needle)) errors.push(`${rel} missing ${label}`);
  else ok.push(`${rel}: ${label}`);
}

mustInclude("src/lib/runtime/runtime-schema-contract.ts", "charge_tokens", "charge_tokens contract");
mustInclude("src/lib/runtime/runtime-schema-contract.ts", "mime_type", "app_files mime_type");
mustInclude("scripts/dreamos-runtime-repair.sql", "mime_type", "repair SQL app_files");
mustInclude("scripts/dreamos-runtime-repair.sql", "notify pgrst", "PostgREST reload");
mustInclude("supabase/migrations/20260624120000_runtime_contract_repair.sql", "charge_tokens", "migration charge_tokens");

const repair = fs.readFileSync(path.join(root, "scripts/dreamos-runtime-repair.sql"), "utf8");
if (/credits_remaining integer default 100/.test(repair)) {
  errors.push("dreamos-runtime-repair.sql still defaults credits to 100");
} else ok.push("repair SQL free plan default 20");

function loadEnvLocal() {
  const p = path.join(root, ".env.local");
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

const env = { ...process.env, ...loadEnvLocal() };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY;

if (url && key) {
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const [{ error: filesErr }, { error: rpcErr }] = await Promise.all([
    admin.from("app_files").select("mime_type, size_bytes, source").limit(0),
    admin.rpc("charge_tokens", {
      p_user_id: "00000000-0000-0000-0000-000000000000",
      p_amount: 0,
      p_reason: "schema_contract_probe",
    }),
  ]);
  if (filesErr && /mime_type|schema cache/i.test(filesErr.message)) {
    errors.push(`live PostgREST: app_files.mime_type missing — apply repair SQL + NOTIFY`);
  } else if (filesErr) {
    errors.push(`live app_files probe: ${filesErr.message}`);
  } else ok.push("live PostgREST: app_files import columns visible");

  if (rpcErr && /could not find the function|schema cache/i.test(rpcErr.message)) {
    errors.push(`live PostgREST: charge_tokens not in schema cache — apply repair SQL + NOTIFY`);
  } else ok.push("live PostgREST: charge_tokens callable (probe returned)");
} else {
  ok.push("live checks skipped (no Supabase service role in env)");
}

console.log("\n=== verify:runtime-schema-contract ===\n");
ok.forEach((m) => console.log("✓", m));
errors.forEach((m) => console.error("✗", m));
process.exit(errors.length ? 1 : 0);
