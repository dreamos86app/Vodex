#!/usr/bin/env node
import fs from "node:fs";
import {
  getBaseUrl,
  serverUp,
  checkGitignore,
  readAuthFile,
  cookiesHeader,
} from "./lib/e2e-live.mjs";

const baseUrl = getBaseUrl();
const errors = [];
const ok = [];

console.log("\n=== verify:e2e-auth ===\n");
console.log(`E2E base URL: ${baseUrl}`);

function fixHint() {
  console.error("\nFix:\n");
  console.error("  1. npm run dev");
  console.error("  2. npm run setup:e2e-auth");
  console.error("     — or —");
  console.error(`     npx playwright codegen ${baseUrl}/create --save-storage=.playwright-auth.json`);
  console.error("  3. npm run verify:e2e-auth\n");
}

const auth = readAuthFile();
if (!auth.meta) {
  console.error("\n════════════════════════════════════════════");
  console.error("  LIVE E2E BLOCKED — .playwright-auth.json missing");
  console.error("════════════════════════════════════════════");
  fixHint();
  process.exit(1);
}

ok.push(`.playwright-auth.json exists (${auth.meta.bytes} bytes)`);
ok.push("auth file is valid JSON");
ok.push(`${auth.meta.cookieCount} cookies (${auth.meta.cookieNames.join(", ") || "none"})`);

if (!auth.ok) {
  errors.push(...auth.errors);
}

const gi = checkGitignore();
if (gi.ok) ok.push(".playwright-auth.json is gitignored");
else errors.push(...gi.errors);

async function validateSession() {
  const cookie = cookiesHeader(auth.json);
  if (!cookie) {
    errors.push("Auth file has no cookies — session not saved");
    return;
  }
  if (!(await serverUp())) {
    errors.push(`Cannot reach ${baseUrl} — start dev server: npm run dev`);
    return;
  }
  try {
    const r = await fetch(`${baseUrl}/api/credits`, {
      headers: { Cookie: cookie },
      redirect: "manual",
    });
    if (r.status === 401) {
      errors.push("Auth session expired or invalid — SETUP_E2E_FORCE=1 npm run setup:e2e-auth");
      return;
    }
    if (r.status >= 500) {
      errors.push(`Cannot validate session — server returned ${r.status}`);
      return;
    }
    ok.push(`session valid (GET /api/credits → ${r.status})`);
  } catch {
    errors.push(`Cannot reach ${baseUrl} — start dev server: npm run dev`);
  }
}

if (errors.length === 0) {
  await validateSession();
}

ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));

if (errors.length) {
  fixHint();
  process.exit(1);
}

console.log("\n✓ Live E2E auth ready\n");
process.exit(0);
