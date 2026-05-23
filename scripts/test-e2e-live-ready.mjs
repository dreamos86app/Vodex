#!/usr/bin/env node
/**
 * One-command live E2E launcher — checks server + auth, runs @live tests, writes evidence.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const authPath = path.join(root, ".playwright-auth.json");
const evidencePath = path.join(root, ".dreamos-evidence.json");
const baseUrl = process.env.E2E_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

console.log("\n=== test:e2e:live:ready ===\n");

async function serverUp() {
  try {
    const r = await fetch(baseUrl, { redirect: "manual" });
    return r.status < 500;
  } catch {
    return false;
  }
}

function writeEvidence(patch) {
  let cur = {};
  try {
    cur = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
  } catch {
    /* */
  }
  fs.writeFileSync(
    evidencePath,
    JSON.stringify({ ...cur, ...patch, e2eLastRun: new Date().toISOString() }, null, 2),
  );
}

if (!(await serverUp())) {
  console.error("✗ Dev server not running at", baseUrl);
  console.error("\nStart it in another terminal:\n");
  console.error("  npm run dev\n");
  writeEvidence({
    e2eMode: "live-skipped-no-auth",
    e2ePassed: false,
    e2eLiveProof: false,
    e2eNote: "Live E2E blocked — dev server not running",
  });
  console.error("\n✗ LIVE E2E BLOCKED — dev server not running\n");
  process.exit(1);
}
console.log(`✓ Dev server up (${baseUrl})`);

if (!fs.existsSync(authPath) || fs.statSync(authPath).size < 10) {
  writeEvidence({
    e2eMode: "live-skipped-no-auth",
    e2ePassed: false,
    e2eLiveProof: false,
    e2eNote: "Live E2E blocked — missing .playwright-auth.json",
  });
  console.error("\n✗ LIVE E2E BLOCKED — .playwright-auth.json missing\n");
  console.error("Run:\n");
  console.error("  npm run setup:e2e-auth\n");
  process.exit(1);
}

const authCheck = spawnSync("node", ["scripts/verify-e2e-auth.mjs"], {
  cwd: root,
  shell: true,
  stdio: "inherit",
});
if (authCheck.status !== 0) {
  writeEvidence({
    e2eMode: "live-skipped-no-auth",
    e2ePassed: false,
    e2eLiveProof: false,
    e2eNote: "Live E2E blocked — auth invalid or expired",
  });
  console.error("\n✗ LIVE E2E BLOCKED — auth invalid\n");
  process.exit(1);
}

console.log("\n--- Running @live Playwright tests ---\n");

const r = spawnSync("npx", ["playwright", "test", "--grep", "@live"], {
  cwd: root,
  shell: true,
  stdio: "inherit",
  env: {
    ...process.env,
    E2E_RUN_LIVE: "1",
    PLAYWRIGHT_SKIP_SERVER: process.env.PLAYWRIGHT_SKIP_SERVER ?? "1",
  },
});

const reportPath = path.join(root, "tests/e2e/report.json");
const tests = [];
if (fs.existsSync(reportPath)) {
  try {
    const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    for (const suite of report.suites ?? []) {
      for (const spec of suite.specs ?? []) {
        const status = spec.tests?.[0]?.results?.[0]?.status ?? (spec.ok ? "passed" : "failed");
        tests.push({ name: spec.title, passed: status === "passed", skipped: status === "skipped" });
      }
    }
  } catch {
    /* */
  }
}

const passed = r.status === 0;
writeEvidence({
  e2eMode: passed ? "live-passed" : "live-failed",
  e2ePassed: passed,
  e2eLiveProof: passed,
  e2eTests: tests,
  e2eNote: passed ? "Live @live journey suite passed" : "Live @live journey suite failed",
  failureCoverage: tests.some((t) => /question/i.test(t.name) && t.passed),
});

if (passed) {
  console.log("\n════════════════════════════════════");
  console.log("  LIVE E2E PASSED");
  console.log("  Evidence: .dreamos-evidence.json");
  console.log("════════════════════════════════════\n");
} else {
  console.error("\n════════════════════════════════════");
  console.error("  LIVE E2E FAILED");
  console.error("  See test-results/ and .dreamos-evidence.json");
  console.error("════════════════════════════════════\n");
}

process.exit(r.status ?? 1);
