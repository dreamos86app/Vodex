#!/usr/bin/env node
/**
 * Diagnose localhost:3000 — port, PID, HTTP probes, actionable fixes.
 */
import {
  devServerBaseUrl,
  diagnoseDevServer,
  probeDevServer,
  READINESS_TIMEOUT_MS,
} from "./lib/dev-server.mjs";

console.log("\n=== doctor:dev-server ===\n");

const base = devServerBaseUrl();
console.log(`Expected base URL: ${base}`);
console.log(`Readiness timeout:   ${READINESS_TIMEOUT_MS / 1000}s (verify scripts)\n`);

const diag = await diagnoseDevServer(base);
console.log(`State: ${diag.state}`);
console.log(`${diag.message}\n`);

if (diag.pid) console.log(`Port 3000 PID: ${diag.pid}`);

const probe = await probeDevServer(base);
console.log("\nProbe detail:");
console.log(`  healthy: ${probe.healthy}`);
console.log(`  url:     ${probe.url ?? "n/a"}`);
console.log(`  status:  ${probe.status ?? "n/a"}`);
if (probe.error) console.log(`  error:   ${probe.error}`);

console.log("\nRecommended actions:");
if (diag.state === "healthy") {
  console.log("  ✓ Dev server is healthy. No action needed.");
} else if (diag.state === "broken") {
  console.log("  1. Stop the stuck process (PID above) or run: npx kill-port 3000");
  console.log("  2. npm run clean:next");
  console.log("  3. npm run dev");
} else {
  console.log("  1. npm run dev");
  console.log("  2. npm run verify:server   (quick check)");
  console.log("  3. npm run verify:fast     (no dev server needed)");
}

console.log("");
process.exit(diag.state === "healthy" ? 0 : 1);
