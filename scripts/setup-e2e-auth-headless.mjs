#!/usr/bin/env node
/**
 * Headless E2E auth — saves .playwright-auth.json via email/password login.
 * Requires E2E_TEST_EMAIL + E2E_TEST_PASSWORD in .env.local (never logged or committed).
 */
import fs from "node:fs";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import {
  ROOT,
  AUTH_PATH,
  getBaseUrl,
  serverUp,
  checkGitignore,
  authFileExists,
  readAuthFile,
  playwrightBrowsersInstalled,
  cookiesHeader,
} from "./lib/e2e-live.mjs";
import {
  isTlsRejectDisabled,
  isSystemCaEnabled,
  printTlsFix,
  safeFetch,
} from "./lib/tls-env.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const AUTH_ARTIFACT_PATH = join(ROOT, "artifacts", "benchmarks", "p13", "e2e-auth-setup.json");
const HARD_TIMEOUT_MS = 60_000;

function loadEnvLocal() {
  const p = join(ROOT, ".env.local");
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

if (!process.env.NODE_USE_SYSTEM_CA) {
  process.env.NODE_USE_SYSTEM_CA = "1";
}

const env = { ...process.env, ...loadEnvLocal() };
let email = env.E2E_TEST_EMAIL?.trim();
let password = env.E2E_TEST_PASSWORD?.trim();
const autoProvision = env.E2E_AUTO_PROVISION === "1";
const baseUrl = getBaseUrl();
const force = env.SETUP_E2E_FORCE === "1" || process.argv.includes("--force");
const setupStartedAt = Date.now();

function writeAuthArtifact(payload) {
  fs.mkdirSync(dirname(AUTH_ARTIFACT_PATH), { recursive: true });
  fs.writeFileSync(
    AUTH_ARTIFACT_PATH,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        base_url: baseUrl,
        force,
        auto_provision: autoProvision,
        duration_ms: Date.now() - setupStartedAt,
        ...payload,
      },
      null,
      2,
    ),
  );
}

function failAuth(reason, extra = {}) {
  writeAuthArtifact({ pass: false, reason, ...extra });
  console.error(`✗ ${reason}`);
  process.exit(1);
}

function assertWithinHardTimeout(phase) {
  if (Date.now() - setupStartedAt > HARD_TIMEOUT_MS) {
    failAuth(`hard_timeout_exceeded during ${phase} (max ${HARD_TIMEOUT_MS / 1000}s)`, {
      phase,
      timeout_ms: HARD_TIMEOUT_MS,
    });
  }
}

async function validateCreditsSession() {
  if (!authFileExists()) return { ok: false, reason: "auth_file_missing" };
  const auth = readAuthFile();
  if (!auth.ok) return { ok: false, reason: "auth_file_invalid", errors: auth.errors };
  const cookie = cookiesHeader(auth.json);
  if (!cookie) return { ok: false, reason: "no_cookies" };
  if (!(await serverUp())) return { ok: false, reason: "server_down" };
  try {
    const r = await fetch(`${baseUrl}/api/credits`, {
      headers: { Cookie: cookie },
      redirect: "manual",
    });
    if (r.status === 401) return { ok: false, reason: "session_expired", status: r.status };
    if (r.status >= 500) return { ok: false, reason: "server_error", status: r.status };
    return { ok: true, status: r.status, bytes: auth.meta?.bytes, cookies: auth.meta?.cookieCount };
  } catch (err) {
    return { ok: false, reason: "fetch_failed", detail: String(err?.message ?? err) };
  }
}

function supabaseAdminConfig() {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl?.startsWith("http") || !serviceKey) return null;
  return { supabaseUrl, serviceKey };
}

async function resetE2eUserPassword(reason) {
  const admin = supabaseAdminConfig();
  if (!admin) return false;
  email = email || "e2e-live@dreamos86.test";
  password = password || `E2e-${crypto.randomUUID().slice(0, 12)}!Aa1`;
  assertWithinHardTimeout("password_reset");
  const listRes = await safeFetch(`${admin.supabaseUrl}/auth/v1/admin/users?page=1&per_page=200`, {
    headers: { apikey: admin.serviceKey, Authorization: `Bearer ${admin.serviceKey}` },
    signal: AbortSignal.timeout(Math.max(5_000, HARD_TIMEOUT_MS - (Date.now() - setupStartedAt))),
  });
  if (!listRes.ok) return false;
  const body = await listRes.json();
  const match = (body?.users ?? []).find(
    (u) => String(u.email ?? "").toLowerCase() === email.toLowerCase(),
  );
  if (!match?.id) return false;
  const updateRes = await safeFetch(`${admin.supabaseUrl}/auth/v1/admin/users/${match.id}`, {
    method: "PUT",
    headers: {
      apikey: admin.serviceKey,
      Authorization: `Bearer ${admin.serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password, email_confirm: true }),
    signal: AbortSignal.timeout(Math.max(5_000, HARD_TIMEOUT_MS - (Date.now() - setupStartedAt))),
  });
  if (!updateRes.ok) return false;
  console.log(`✓ Reset E2E password (${reason})`);
  return true;
}

async function ensureProvisionedUser() {
  if (!autoProvision) return;
  email = email || "e2e-live@dreamos86.test";
  password = password || `E2e-${crypto.randomUUID().slice(0, 12)}!Aa1`;

  const admin = supabaseAdminConfig();
  if (!admin) {
    console.error("✗ E2E_AUTO_PROVISION=1 requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const listRes = await safeFetch(`${admin.supabaseUrl}/auth/v1/admin/users?page=1&per_page=200`, {
    headers: { apikey: admin.serviceKey, Authorization: `Bearer ${admin.serviceKey}` },
  });
  let existingId = null;
  if (listRes.ok) {
    const body = await listRes.json();
    const match = (body?.users ?? []).find(
      (u) => String(u.email ?? "").toLowerCase() === email.toLowerCase(),
    );
    existingId = match?.id ?? null;
    if (existingId) {
      if (force) {
        await resetE2eUserPassword("SETUP_E2E_FORCE=1");
      } else {
        console.log(`✓ E2E user already exists (${email}) — skipping password reset`);
      }
      return;
    }
  }

  const createRes = await safeFetch(`${admin.supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: admin.serviceKey,
      Authorization: `Bearer ${admin.serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!createRes.ok) {
    const errText = await createRes.text();
    console.error(`✗ Failed to provision E2E user (HTTP ${createRes.status})`);
    if (!/already|exists|duplicate/i.test(errText)) {
      console.error("  Re-run with E2E_TEST_EMAIL/E2E_TEST_PASSWORD for an existing account.");
      process.exit(1);
    }
  } else {
    console.log(`✓ Provisioned E2E user (${email})`);
  }
}

console.log("\n=== setup:e2e-auth (headless) ===\n");

if (isTlsRejectDisabled()) {
  console.error("✗ NODE_TLS_REJECT_UNAUTHORIZED=0 is set — remove from OS env before E2E auth.");
  printTlsFix();
  process.exit(1);
}

if (!isSystemCaEnabled()) {
  console.log("ℹ NODE_USE_SYSTEM_CA not set — dev server should use npm run dev (sets it automatically).");
}

const gi = checkGitignore();
if (!gi.ok) {
  gi.errors.forEach((e) => console.error(`✗ ${e}`));
  process.exit(1);
}

if (autoProvision) {
  await ensureProvisionedUser();
} else if (!email || !password) {
  console.error("✗ E2E_TEST_EMAIL and E2E_TEST_PASSWORD required in .env.local for headless auth.");
  console.error("  — or set E2E_AUTO_PROVISION=1 to create a local-only test user via service role.\n");
  console.error("Alternatively run interactive setup:\n");
  console.error("  npm run setup:e2e-auth\n");
  process.exit(1);
}

if (!email || !password) {
  console.error("✗ E2E credentials missing after provisioning.");
  process.exit(1);
}

if (!(await serverUp())) {
  console.error(`✗ Dev server not running at ${baseUrl}`);
  console.error("\n  npm run dev\n");
  process.exit(1);
}

if (!playwrightBrowsersInstalled()) {
  console.error("✗ Playwright browsers not installed — run: npx playwright install\n");
  process.exit(1);
}

if (force && fs.existsSync(AUTH_PATH)) {
  fs.unlinkSync(AUTH_PATH);
}

if (authFileExists() && !force) {
  const session = await validateCreditsSession();
  if (session.ok) {
    console.log(
      `✓ Reusing .playwright-auth.json (${session.bytes ?? "?"} bytes, GET /api/credits → ${session.status})`,
    );
    writeAuthArtifact({ pass: true, reused: true, credits_status: session.status });
    process.exit(0);
  }
  console.log(`ℹ Existing auth invalid (${session.reason}) — re-authenticating`);
}

async function writeApiAuthFallback() {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl?.startsWith("http") || !anonKey || !email || !password) return false;

  const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) return false;

  let cookieRef = "auth";
  try {
    const host = new URL(supabaseUrl).hostname.split(".")[0];
    if (host) cookieRef = host;
  } catch {
    /* */
  }
  const cookieName = `sb-${cookieRef}-auth-token`;
  const value = `base64-${Buffer.from(JSON.stringify(data.session)).toString("base64")}`;
  fs.writeFileSync(
    AUTH_PATH,
    JSON.stringify(
      {
        cookies: [
          {
            name: cookieName,
            value,
            domain: "localhost",
            path: "/",
            expires: -1,
            httpOnly: false,
            secure: false,
            sameSite: "Lax",
          },
        ],
        origins: [],
      },
      null,
      2,
    ),
  );
  console.log(`✓ API auth fallback wrote ${cookieName}`);
  return true;
}

async function verifyAuthFileOrFail() {
  const verifyApi = spawnSync("node", [join(scriptDir, "verify-e2e-auth.mjs")], {
    cwd: ROOT,
    shell: true,
    stdio: "inherit",
  });
  return verifyApi.status === 0;
}

if (await writeApiAuthFallback() && (await verifyAuthFileOrFail())) {
  writeAuthArtifact({ pass: true, reused: false, method: "api_sign_in" });
  process.exit(0);
}

if (autoProvision && (await resetE2eUserPassword("credential_mismatch_recovery"))) {
  if (await writeApiAuthFallback() && (await verifyAuthFileOrFail())) {
    writeAuthArtifact({ pass: true, reused: false, method: "api_sign_in_after_reset" });
    process.exit(0);
  }
}

console.log(`Signing in at ${baseUrl}/auth/login (headless)…\n`);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

try {
  await page.goto(`${baseUrl}/auth/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]:not([disabled])');

  // Next.js client router.replace does not always emit a navigation event Playwright can wait on.
  const loginDeadline = Math.min(Date.now() + 45_000, setupStartedAt + HARD_TIMEOUT_MS);
  let leftLogin = false;
  while (Date.now() < loginDeadline) {
    const pathname = new URL(page.url()).pathname;
    if (!pathname.includes("/auth/login")) {
      leftLogin = true;
      break;
    }
    const errText = await page
      .locator('[role="alert"], .text-destructive, [class*="destructive"]')
      .first()
      .textContent()
      .catch(() => "");
    if (errText?.trim()) {
      if (/incorrect|invalid|password/i.test(errText) && autoProvision) {
        console.log("ℹ UI login rejected credentials — one-time password recovery…");
        await browser.close();
        if (await resetE2eUserPassword("ui_login_mismatch")) {
          if (await writeApiAuthFallback() && (await verifyAuthFileOrFail())) {
            writeAuthArtifact({ pass: true, reused: false, method: "api_sign_in_after_ui_mismatch" });
            process.exit(0);
          }
        }
      }
      failAuth("ui_login_failed", { ui_error: errText.trim().slice(0, 200) });
    }
    await page.waitForTimeout(500);
  }

  if (!leftLogin) {
    console.warn("⚠ Headless UI login timed out — trying API auth fallback…");
    await browser.close();
    if (
      !(await writeApiAuthFallback()) &&
      !(autoProvision && (await resetE2eUserPassword("browser_timeout_recovery")) && (await writeApiAuthFallback()))
    ) {
      failAuth("headless_login_timeout_and_api_fallback_failed", { phase: "browser_login" });
    }
    if (!(await verifyAuthFileOrFail())) {
      failAuth("auth_verify_failed_after_browser_timeout_recovery", { phase: "browser_login" });
    }
    writeAuthArtifact({ pass: true, reused: false, method: "api_sign_in_after_browser_timeout" });
    process.exit(0);
  }

  await page.goto(`${baseUrl}/create`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await context.storageState({ path: AUTH_PATH });
} catch (err) {
  const msg = String(err?.message ?? err);
  if (/certificate|UNABLE_TO_VERIFY/i.test(msg)) {
    console.error("✗ TLS error during headless login.");
    printTlsFix();
  } else {
    console.error(`✗ Headless login failed: ${msg}`);
  }
  process.exit(1);
} finally {
  await browser.close();
}

const auth = readAuthFile();
if (!auth.ok) {
  auth.errors.forEach((e) => console.error(`✗ ${e}`));
  process.exit(1);
}

console.log(`✓ .playwright-auth.json created (${auth.meta.bytes} bytes, ${auth.meta.cookieCount} cookies)`);

const verify = spawnSync("node", [join(scriptDir, "verify-e2e-auth.mjs")], {
  cwd: ROOT,
  shell: true,
  stdio: "inherit",
});
if (verify.status === 0) {
  writeAuthArtifact({ pass: true, reused: false, method: "headless_login" });
}
process.exit(verify.status ?? 1);
