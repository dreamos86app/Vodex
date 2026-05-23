#!/usr/bin/env node
/**
 * verify:all with a clear preflight when localhost:3000 is down (editor E2E needs it).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { devServerBaseUrl, diagnoseDevServer, printDevServerRequired } from "./lib/dev-server.mjs";
import { runStep } from "./lib/verify-runner.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = devServerBaseUrl();

console.log("\n=== verify:all:local ===\n");

const diag = await diagnoseDevServer(base);
if (diag.state !== "healthy") {
  printDevServerRequired(base, diag);
  console.error("verify:editor (inside verify:all) requires a healthy dev server.\n");
  process.exit(1);
}

console.log(`✓ ${diag.message}\n`);

const r = await runStep("verify:all", "npm run verify:all", {
  cwd: root,
  env: { ...process.env, NODE_USE_SYSTEM_CA: process.env.NODE_USE_SYSTEM_CA ?? "1" },
});

process.exit(r.status ?? 1);
