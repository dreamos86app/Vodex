#!/usr/bin/env node
/**
 * Starts dev server if needed (90s max), runs verify:all, then shuts down.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  devServerBaseUrl,
  diagnoseDevServer,
  waitForDevServer,
  READINESS_TIMEOUT_MS,
} from "./lib/dev-server.mjs";
import { runStep, formatElapsed } from "./lib/verify-runner.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = devServerBaseUrl();

console.log("\n=== verify:all:with-server ===\n");

let devProc = null;
let startedByUs = false;

async function killDevProc() {
  if (!startedByUs || !devProc) return;
  console.log("\n[dev-server] Stopping dev server we started…\n");
  devProc.kill("SIGTERM");
  await new Promise((r) => setTimeout(r, 1500));
  if (!devProc.killed) devProc.kill("SIGKILL");
}

const diag = await diagnoseDevServer(base);
if (diag.state === "healthy") {
  console.log(`[dev-server] ✓ Reusing: ${diag.message}\n`);
} else if (diag.state === "broken") {
  console.error(`✗ ${diag.message}\n`);
  process.exit(1);
} else {
  console.log("[dev-server] Starting npm run dev…\n");
  devProc = spawn("npm run dev", {
    cwd: root,
    shell: true,
    stdio: "inherit",
    env: { ...process.env, NODE_USE_SYSTEM_CA: process.env.NODE_USE_SYSTEM_CA ?? "1" },
  });
  startedByUs = true;
  const wait = await waitForDevServer({
    baseUrl: base,
    timeoutMs: READINESS_TIMEOUT_MS,
    onTick: (msg) => console.log(`[dev-server] ${msg}`),
  });
  if (!wait.ok) {
    console.error("\n✗ Dev server not ready within 90s.\n");
    await killDevProc();
    process.exit(1);
  }
}

const r = await runStep("verify:all", "npm run verify:all", {
  cwd: root,
  env: { ...process.env, NODE_USE_SYSTEM_CA: process.env.NODE_USE_SYSTEM_CA ?? "1" },
});

await killDevProc();
process.exit(r.status ?? 1);
