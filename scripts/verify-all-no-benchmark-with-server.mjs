#!/usr/bin/env node
/**
 * Starts dev server if needed (90s max), runs verify:all:no-benchmark, stops server we started.
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

console.log("\n=== verify:all:no-benchmark:with-server ===\n");

let devProc = null;
let startedByUs = false;
const devLogTail = [];

async function killDevProc() {
  if (!startedByUs || !devProc) return;
  console.log("\n[dev-server] Stopping dev server we started…\n");
  devProc.kill("SIGTERM");
  await new Promise((r) => setTimeout(r, 1500));
  if (!devProc.killed) devProc.kill("SIGKILL");
  devProc = null;
}

async function startDevServer() {
  console.log("[dev-server] Starting npm run dev…\n");
  devProc = spawn("npm run dev", {
    cwd: root,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NODE_USE_SYSTEM_CA: process.env.NODE_USE_SYSTEM_CA ?? "1" },
  });
  startedByUs = true;

  const pushLog = (d) => {
    const s = d.toString();
    devLogTail.push(s);
    if (devLogTail.length > 100) devLogTail.shift();
    process.stdout.write(s);
  };
  devProc.stdout?.on("data", pushLog);
  devProc.stderr?.on("data", pushLog);

  const wait = await waitForDevServer({
    baseUrl: base,
    timeoutMs: READINESS_TIMEOUT_MS,
    onTick: (msg) => console.log(`[dev-server] ${msg}`),
  });

  if (!wait.ok) {
    console.error("\n✗ Dev server did not become ready within 90s.\n");
    console.error(`  ${wait.diagnose?.message ?? "Unknown"}`);
    if (devLogTail.length) {
      console.error("\n--- last dev server output ---");
      console.error(devLogTail.slice(-20).join("").slice(-4000));
      console.error("--- end ---\n");
    }
    await killDevProc();
    process.exit(1);
  }

  console.log(`[dev-server] ✓ Ready at ${wait.url} in ${formatElapsed(wait.elapsed)}\n`);
}

const suiteStart = Date.now();
const diag = await diagnoseDevServer(base);

if (diag.state === "healthy") {
  console.log(`[dev-server] ✓ Reusing running server: ${diag.message}\n`);
} else if (diag.state === "broken") {
  console.error(`✗ Port 3000 occupied but not healthy: ${diag.message}`);
  console.error("  Fix with: npm run doctor:dev-server\n");
  process.exit(1);
} else {
  await startDevServer();
}

const r = await runStep("verify:all:no-benchmark", "npm run verify:all:no-benchmark", {
  cwd: root,
  env: { ...process.env, NODE_USE_SYSTEM_CA: process.env.NODE_USE_SYSTEM_CA ?? "1" },
  maxSilenceMs: 120_000,
  maxTotalMs: 900_000,
});

await killDevProc();

console.log(
  `\n=== verify:all:no-benchmark:with-server ${r.status === 0 ? "PASSED" : "FAILED"} in ${formatElapsed(Date.now() - suiteStart)} ===\n`,
);
process.exit(r.status ?? 1);
