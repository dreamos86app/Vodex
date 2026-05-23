#!/usr/bin/env node
/**
 * Diagnose TLS trust for Supabase + local dev login.
 * Safe fix: NODE_USE_SYSTEM_CA=1 — never NODE_TLS_REJECT_UNAUTHORIZED=0.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  isSystemCaEnabled,
  isTlsRejectDisabled,
  isTlsFetchError,
  printTlsFix,
  safeFetch,
  withSafeTlsEnv,
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
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL ?? "(not set)";

console.log("\n=== verify:tls ===\n");
console.log("Current Node TLS state");
console.log(`  Node version:     ${process.version}`);
console.log(`  Platform:         ${process.platform}`);
console.log(`  Supabase URL:     ${supabaseUrl}`);
console.log(
  `  NODE_USE_SYSTEM_CA: ${isSystemCaEnabled() ? "1 (enabled — good for Windows)" : "not set (recommended on Windows)"}`,
);
console.log(
  `  NODE_TLS_REJECT_UNAUTHORIZED: ${isTlsRejectDisabled() ? "0 — DANGEROUS, remove this" : "not disabled (good)"}`,
);
console.log(
  `  npm run dev:        ${process.env.npm_lifecycle_event === "dev" ? "running with TLS env from script" : "uses cross-env NODE_USE_SYSTEM_CA=1"}`,
);

const errors = [];
const warnings = [];
const ok = [];

if (isTlsRejectDisabled()) {
  errors.push("NODE_TLS_REJECT_UNAUTHORIZED=0 is set — remove from Windows User/System Environment Variables");
} else {
  ok.push("TLS verification not globally disabled");
}

if (!isSystemCaEnabled()) {
  warnings.push("NODE_USE_SYSTEM_CA is not set — local login may fail with UNABLE_TO_VERIFY_LEAF_SIGNATURE");
} else {
  ok.push("NODE_USE_SYSTEM_CA=1 is enabled");
}

if (process.platform === "win32" && !isSystemCaEnabled()) {
  warnings.push("Windows dev requires NODE_USE_SYSTEM_CA=1 so Node trusts the OS certificate store");
}

if (!supabaseUrl.startsWith("http")) {
  errors.push("NEXT_PUBLIC_SUPABASE_URL missing or invalid in .env.local");
}

const sr = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY ?? "";
if (!sr) {
  errors.push("SUPABASE_SERVICE_ROLE_KEY missing in .env.local — cannot probe TLS");
} else if (supabaseUrl.startsWith("http")) {
  try {
    const res = await safeFetch(`${supabaseUrl}/rest/v1/profiles?select=id&limit=1`, {
      headers: {
        apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? sr,
        Authorization: `Bearer ${sr}`,
      },
    });
    ok.push(`Supabase TLS probe succeeded (HTTP ${res.status})`);
  } catch (err) {
    if (isTlsFetchError(err)) {
      errors.push("TLS certificate verification failed on Supabase probe (UNABLE_TO_VERIFY_LEAF_SIGNATURE)");
    } else {
      errors.push(`Network error: ${String(err?.message ?? err)}`);
    }
  }
}

// Probe local dev server auth path if running
const devUrl = env.E2E_BASE_URL ?? env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
try {
  const devRes = await fetch(`${devUrl}/auth/login`, { redirect: "manual" });
  if (devRes.status < 500) {
    ok.push(`Dev server reachable at ${devUrl} (HTTP ${devRes.status})`);
  }
} catch {
  warnings.push(`Dev server not reachable at ${devUrl} — start with: npm run dev`);
}

warnings.forEach((m) => console.warn(`⚠ ${m}`));
ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));

if (errors.length || warnings.some((w) => w.includes("NODE_USE_SYSTEM_CA"))) {
  console.error("\n--- Why local login fails ---");
  console.error("  fetch failed / UNABLE_TO_VERIFY_LEAF_SIGNATURE on Supabase server-side calls");
  console.error("  → auth callback, session checks, and profile bootstrap all fail");
  console.error("  → app appears logged out after OAuth or password login\n");

  console.error("--- Exact fix (Cursor terminal, PowerShell) ---\n");
  console.error('  $env:NODE_USE_SYSTEM_CA="1"\n');
  console.error("  npm run verify:tls");
  console.error("  npm run dev\n");
  console.error("Or rely on npm run dev (sets NODE_USE_SYSTEM_CA=1 automatically).\n");
  console.error("Never use NODE_TLS_REJECT_UNAUTHORIZED=0 in scripts or .env.\n");

  if (errors.some((e) => e.includes("TLS certificate"))) {
    printTlsFix(supabaseUrl);
  }
}

if (errors.length) {
  process.exit(1);
}

// Apply safe TLS for remainder of verify pipeline when sourced from verify:all
withSafeTlsEnv(process.env);

console.log("\n✓ TLS verify OK\n");
process.exit(0);
