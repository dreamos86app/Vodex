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
} from "./lib/e2e-live.mjs";
import {
  isTlsRejectDisabled,
  isSystemCaEnabled,
  printTlsFix,
  safeFetch,
} from "./lib/tls-env.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));

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

async function ensureProvisionedUser() {
  if (!autoProvision) return;
  email = email || "e2e-live@dreamos86.test";
  password = password || `E2e-${crypto.randomUUID().slice(0, 12)}!Aa1`;

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl?.startsWith("http") || !serviceKey) {
    console.error("✗ E2E_AUTO_PROVISION=1 requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const listRes = await safeFetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=200`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  let existingId = null;
  if (listRes.ok) {
    const body = await listRes.json();
    const match = (body?.users ?? []).find(
      (u) => String(u.email ?? "").toLowerCase() === email.toLowerCase(),
    );
    existingId = match?.id ?? null;
    if (existingId) {
      console.log(`✓ E2E user already exists (${email}) — resetting password for local proof`);
      const updateRes = await safeFetch(`${supabaseUrl}/auth/v1/admin/users/${existingId}`, {
        method: "PUT",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password, email_confirm: true }),
      });
      if (!updateRes.ok) {
        console.error(`✗ Failed to reset E2E user password (HTTP ${updateRes.status})`);
        process.exit(1);
      }
      return;
    }
  }

  const createRes = await safeFetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
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
  const auth = readAuthFile();
  console.log(`✓ .playwright-auth.json already exists (${auth.meta?.bytes ?? "?"} bytes)`);
  const v = spawnSync("node", ["scripts/verify-e2e-auth.mjs"], { cwd: ROOT, shell: true, stdio: "inherit" });
  process.exit(v.status ?? 0);
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
  const loginDeadline = Date.now() + 60_000;
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
      console.error("✗ Login failed — check E2E credentials or Supabase auth.");
      console.error(`  UI: ${errText.trim().slice(0, 200)}`);
      process.exit(1);
    }
    await page.waitForTimeout(500);
  }

  if (!leftLogin) {
    console.warn("⚠ Headless UI login timed out — trying API auth fallback…");
    await browser.close();
    if (!(await writeApiAuthFallback())) {
      console.error("✗ Headless login timed out and API auth fallback failed.");
      process.exit(1);
    }
    const verifyFallback = spawnSync("node", [join(scriptDir, "verify-e2e-auth.mjs")], {
      cwd: ROOT,
      shell: true,
      stdio: "inherit",
    });
    process.exit(verifyFallback.status ?? 1);
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
process.exit(verify.status ?? 1);
