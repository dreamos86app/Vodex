#!/usr/bin/env node
/**
 * Guided live E2E auth setup — never prints or commits secrets.
 */
import fs from "node:fs";
import { spawnSync } from "node:child_process";
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
} from "./lib/tls-env.mjs";

const baseUrl = getBaseUrl();
const force = process.env.SETUP_E2E_FORCE === "1" || process.argv.includes("--force");
const codegenCmd = `npx playwright codegen ${baseUrl}/create --save-storage=.playwright-auth.json`;

console.log("\n=== setup:e2e-auth ===\n");
console.log(`Base URL: ${baseUrl}\n`);

if (isTlsRejectDisabled()) {
  console.error("✗ NODE_TLS_REJECT_UNAUTHORIZED=0 is set — remove it before E2E auth setup.");
  printTlsFix();
  process.exit(1);
}
if (!isSystemCaEnabled()) {
  console.log("ℹ Tip: npm run dev sets NODE_USE_SYSTEM_CA=1 automatically on Windows.\n");
}

const gi = checkGitignore();
if (!gi.ok) {
  gi.errors.forEach((e) => console.error(`✗ ${e}`));
  process.exit(1);
}
console.log("✓ .playwright-auth.json is gitignored");
console.log("✓ evidence/benchmark artifacts gitignored");

if (!(await serverUp())) {
  console.log("⚠ Dev server not responding at", baseUrl);
  console.log("\nStart it in a separate terminal:\n");
  console.log("  npm run dev\n");
  console.log("(dev sets NODE_USE_SYSTEM_CA=1 for Windows TLS)\n");
  console.log("Wait until the app loads, then run:\n");
  console.log("  npm run setup:e2e-auth\n");
  process.exit(1);
}
console.log("✓ Dev server is up\n");

if (!playwrightBrowsersInstalled()) {
  console.error("✗ Playwright browsers not installed.\n");
  console.error("  npx playwright install\n");
  console.error("Then re-run:\n");
  console.error("  npm run setup:e2e-auth\n");
  process.exit(1);
}
console.log("✓ Playwright browsers available\n");

if (force && fs.existsSync(AUTH_PATH)) {
  fs.unlinkSync(AUTH_PATH);
  console.log("✓ Removed existing auth (--force)\n");
}

if (authFileExists() && !force) {
  const auth = readAuthFile();
  console.log(`✓ .playwright-auth.json already exists (${auth.meta?.bytes ?? "?"} bytes)`);
  if (auth.meta?.cookieCount) {
    console.log(`  cookies: ${auth.meta.cookieCount} (${auth.meta.cookieNames.join(", ")})`);
  }
  console.log("\nTo reset expired auth:\n");
  console.log("  SETUP_E2E_FORCE=1 npm run setup:e2e-auth\n");
  const v = spawnSync("node", ["scripts/verify-e2e-auth.mjs"], { cwd: ROOT, shell: true, stdio: "inherit" });
  if (v.status === 0) {
    console.log("\nNext: npm run prove:live\n");
  }
  process.exit(v.status ?? 0);
}

console.log("Auth file missing — sign in via Playwright codegen.\n");
console.log("Command (also run manually if browser does not open):\n");
console.log(`  ${codegenCmd}\n`);
console.log("Steps:");
console.log("  1. Sign in when the browser opens");
console.log("  2. Navigate to /create (confirm you see the create funnel)");
console.log("  3. Close the codegen window to save storage\n");
console.log("Secrets: auth is saved locally only — never commit .playwright-auth.json\n");

const codegen = spawnSync(
  "npx",
  ["playwright", "codegen", `${baseUrl}/create`, "--save-storage=.playwright-auth.json"],
  { cwd: ROOT, shell: true, stdio: "inherit" },
);

if (!authFileExists()) {
  console.error("\n✗ .playwright-auth.json was not created or is empty.");
  console.error("\nRun manually:\n");
  console.error(`  ${codegenCmd}\n`);
  process.exit(codegen.status ?? 1);
}

const auth = readAuthFile();
if (!auth.ok) {
  auth.errors.forEach((e) => console.error(`✗ ${e}`));
  process.exit(1);
}

console.log(`✓ .playwright-auth.json created (${auth.meta.bytes} bytes, ${auth.meta.cookieCount} cookies)`);

const verify = spawnSync("node", ["scripts/verify-e2e-auth.mjs"], { cwd: ROOT, shell: true, stdio: "inherit" });
if (verify.status === 0) {
  console.log("\nNext: npm run prove:live\n");
}
process.exit(verify.status ?? 1);
