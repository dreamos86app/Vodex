#!/usr/bin/env node
/**
 * Local health check — loads .env.local and probes Supabase + build tools.
 * Usage: node scripts/verify-production-health.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env.local");

function loadEnv() {
  if (!existsSync(envPath)) return {};
  const out = {};
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

function jwtRef(key) {
  try {
    const payload = key.split(".")[1];
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return json.ref ?? null;
  } catch {
    return null;
  }
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const sr = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY ?? "";
const urlRef = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? null;
const anonRef = anon.startsWith("eyJ") ? jwtRef(anon) : null;
const srRef = sr.startsWith("eyJ") ? jwtRef(sr) : urlRef;

const errors = [];
const ok = [];

if (!url) errors.push("NEXT_PUBLIC_SUPABASE_URL missing");
if (!anon) errors.push("NEXT_PUBLIC_SUPABASE_ANON_KEY missing");
if (!sr) errors.push("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY missing");
if (urlRef && anonRef && urlRef !== anonRef) {
  errors.push(`URL ref (${urlRef}) !== anon JWT ref (${anonRef})`);
}
if (urlRef && srRef && sr.startsWith("eyJ") && urlRef !== srRef) {
  errors.push(`URL ref (${urlRef}) !== service_role JWT ref (${srRef})`);
}
if (urlRef === "wciioegiczwqlmlroley") ok.push("Canonical project ref wciioegiczwqlmlroley");

async function rest(path, method = "GET", body) {
  // Emergency only: set DREAMOS_VERIFY_INSECURE_TLS=1 for one-off local TLS diagnosis — never in production.
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
    console.warn(
      "WARNING: NODE_TLS_REJECT_UNAUTHORIZED=0 disables certificate verification. Remove from .env for normal dev.",
    );
  }
  if (process.env.DREAMOS_VERIFY_INSECURE_TLS === "1") {
    console.warn("WARNING: DREAMOS_VERIFY_INSECURE_TLS=1 — diagnostic only, not a standard fix.");
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }
  const res = await fetch(`${url}${path}`, {
    method,
    headers: {
      apikey: anon,
      Authorization: `Bearer ${sr}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

console.log("\n=== DreamOS86 env alignment ===\n");
console.log("URL:", url);
console.log("URL ref:", urlRef);
console.log("Anon ref:", anonRef ?? "(publishable/non-JWT)");
console.log("Service ref:", srRef ?? "(sb_secret)");

if (errors.length) {
  console.log("\nENV ERRORS:");
  errors.forEach((e) => console.log("  ✗", e));
} else {
  console.log("\nENV: OK");
  ok.forEach((m) => console.log("  ✓", m));
}

if (url && sr) {
  console.log("\n=== Supabase PostgREST probes (service role) ===\n");
  const probes = [
    ["profiles", "/rest/v1/profiles?select=id&limit=1"],
    ["admin_audit_logs", "/rest/v1/admin_audit_logs?select=id&limit=0"],
    ["runtime_diagnostics", "/rest/v1/runtime_diagnostics?select=id&limit=0"],
    ["dreamos_debug_credit_rpc", "/rest/v1/rpc/dreamos_debug_credit_rpc", "POST", {}],
    ["charge_tokens invalid", "/rest/v1/rpc/charge_tokens", "POST", { p_user_id: null, p_amount: 0 }],
  ];
  for (const [name, path, method = "GET", body] of probes) {
    const { status, json } = await rest(path, method, body);
    const pass =
      status < 400 ||
      (name === "charge_tokens invalid" && status === 200 && json?.error);
    console.log(pass ? "  ✓" : "  ✗", name, `→ HTTP ${status}`, typeof json === "object" ? JSON.stringify(json).slice(0, 120) : json);
    if (!pass) errors.push(`PostgREST ${name}: ${status} ${JSON.stringify(json).slice(0, 200)}`);
  }
}

console.log("\n=== TypeScript ===\n");
const tsc = spawnSync("npx", ["tsc", "--noEmit"], { cwd: root, shell: true, encoding: "utf8" });
if (tsc.status === 0) console.log("  ✓ tsc --noEmit");
else {
  console.log("  ✗ tsc failed");
  console.log(tsc.stdout || tsc.stderr);
  errors.push("tsc --noEmit failed");
}

console.log("\n=== Summary ===\n");
if (errors.length === 0) {
  console.log("All checks passed.");
  process.exit(0);
}
console.log(`${errors.length} issue(s):`);
errors.forEach((e) => console.log(" -", e));
process.exit(1);
