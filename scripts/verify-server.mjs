#!/usr/bin/env node
/**
 * Quick dev-server health check — fails fast with diagnosis.
 */
import {
  devServerBaseUrl,
  diagnoseDevServer,
  waitForDevServer,
  READINESS_TIMEOUT_MS,
} from "./lib/dev-server.mjs";
import { formatElapsed } from "./lib/verify-runner.mjs";

console.log("\n=== verify:server ===\n");
const base = devServerBaseUrl();
const started = Date.now();
const diag = await diagnoseDevServer(base);

console.log(`Base URL: ${base}`);
console.log(`State:    ${diag.state}`);
console.log(`Detail:   ${diag.message}`);
if (diag.pid) console.log(`PID:      ${diag.pid}`);

if (diag.state === "healthy") {
  console.log(`\n✓ verify:server passed in ${formatElapsed(Date.now() - started)}\n`);
  process.exit(0);
}

if (diag.state === "broken") {
  console.error("\n✗ Port 3000 is occupied but HTTP is not healthy.");
  console.error("  Run: npm run doctor:dev-server");
  console.error("  Or:  npm run clean:next && npm run dev\n");
  process.exit(1);
}

console.log("\nDev server not running. Waiting up to 90s (start npm run dev in another terminal)…\n");
const wait = await waitForDevServer({
  baseUrl: base,
  timeoutMs: READINESS_TIMEOUT_MS,
  onTick: (msg) => console.log(`[verify:server] ${msg}`),
});

if (wait.ok) {
  console.log(`\n✓ Dev server became ready at ${wait.url} in ${formatElapsed(wait.elapsed)}\n`);
  process.exit(0);
}

console.error("\n✗ Dev server not ready within 90s.");
console.error(`  ${wait.diagnose?.message ?? "Unknown error"}\n`);
process.exit(1);
