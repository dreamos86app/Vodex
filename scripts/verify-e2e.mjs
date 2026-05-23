#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { withSafeTlsEnv } from "./lib/tls-env.mjs";
import { parsePlaywrightReport, loadEvidence, writeEvidence as writeEvidenceShared } from "./lib/e2e-live.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const authPath = path.join(root, ".playwright-auth.json");
const evidencePath = path.join(root, ".dreamos-evidence.json");

const specs = [
  "tests/e2e/question-intent.spec.ts",
  "tests/e2e/create-app.spec.ts",
  "tests/e2e/blueprint-approval.spec.ts",
  "tests/e2e/dashboard-lifecycle.spec.ts",
  "tests/e2e/builder-diff.spec.ts",
  "tests/e2e/polish-pass.spec.ts",
  "tests/e2e/publish-public-url.spec.ts",
  "tests/e2e/deploy-vercel.spec.ts",
  "tests/e2e/insufficient-credits.spec.ts",
  "tests/e2e/mobile-create.spec.ts",
  "tests/e2e/no-placeholder-app.spec.ts",
  "tests/e2e/preview-runtime.spec.ts",
  "tests/e2e/single-create-funnel.spec.ts",
  "tests/e2e/create-style-template-tier.spec.ts",
  "tests/e2e/create-dashboard-handoff.spec.ts",
  "tests/e2e/live-journeys.spec.ts",
  "tests/e2e/failure-repair.spec.ts",
  "tests/e2e/mobile-layout.spec.ts",
  "tests/e2e/preview-publish-deploy-live.spec.ts",
  "tests/e2e/editor-checkpoints-live.spec.ts",
  "tests/e2e/public-landing.spec.ts",
];

function writeEvidence(patch) {
  writeEvidenceShared(patch);
}

const errors = [];
for (const s of specs) {
  if (!fs.existsSync(path.join(root, s))) errors.push(`missing ${s}`);
}

if (errors.length) {
  console.error("\n✗ verify:e2e structure failed\n", errors.join("\n"));
  process.exit(1);
}

console.log("\n=== verify:e2e ===\n");
console.log(`✓ All ${specs.length} E2E spec files present`);

const liveRequested = process.env.E2E_RUN_LIVE === "1";

if (!liveRequested) {
  const cur = loadEvidence();
  const preserveLive =
    cur.e2eLiveProof === true && cur.e2eMode === "live-passed" && cur.e2ePassed === true;
  if (preserveLive) {
    writeEvidence({
      e2eNote: "STRUCTURE-ONLY PASS — live E2E proof preserved from prior run",
    });
  } else {
    writeEvidence({
      e2eMode: "structure-only",
      e2ePassed: false,
      e2eLiveProof: false,
      e2eNote: "STRUCTURE-ONLY PASS — NOT LIVE PROOF",
    });
  }
  console.log("\n════════════════════════════════════════════");
  console.log(preserveLive ? "  STRUCTURE-ONLY PASS — LIVE PROOF PRESERVED" : "  STRUCTURE-ONLY PASS — NOT LIVE PROOF");
  console.log("════════════════════════════════════════════");
  if (!preserveLive) {
    console.log("\n  User-flow scores stay capped at 85 until live E2E passes.");
    console.log("\n  Run live proof:");
    console.log("    npm run test:e2e:live:ready\n");
  }
  process.exit(0);
}

console.log("\n--- Live E2E requested ---\n");

if (!fs.existsSync(authPath) || fs.statSync(authPath).size < 10) {
  writeEvidence({
    e2eMode: "live-skipped-no-auth",
    e2ePassed: false,
    e2eLiveProof: false,
    e2eNote: "LIVE E2E BLOCKED — .playwright-auth.json missing",
  });
  console.error("\n════════════════════════════════════════════");
  console.error("  LIVE E2E BLOCKED — .playwright-auth.json missing");
  console.error("════════════════════════════════════════════");
  console.error("\n  npm run setup:e2e-auth\n");
  process.exit(1);
}

const authCheck = spawnSync("node", ["scripts/verify-e2e-auth.mjs"], { cwd: root, shell: true, stdio: "inherit" });
if (authCheck.status !== 0) process.exit(1);

const r = spawnSync("npx", ["playwright", "test", "--grep", "@live"], {
  cwd: root,
  shell: true,
  stdio: "inherit",
  env: { ...process.env, E2E_RUN_LIVE: "1", PLAYWRIGHT_SKIP_SERVER: process.env.PLAYWRIGHT_SKIP_SERVER ?? "1" },
});

const reportPath = path.join(root, "tests/e2e/report.json");
const tests = parsePlaywrightReport(reportPath);
const passedCount = tests.filter((t) => t.passed).length;
const failedCount = tests.filter((t) => t.failed).length;
const skippedCount = tests.filter((t) => t.skipped).length;

const passed = r.status === 0;
const partial = !passed && passedCount > 0 && failedCount > 0;

writeEvidence({
  e2eMode: passed ? "live-passed" : partial ? "live-partial" : "live-failed",
  e2ePassed: passed,
  e2eLiveProof: passed,
  e2eTests: tests.map((t) => ({ name: t.name, passed: t.passed, skipped: t.skipped })),
  e2eCounts: { passed: passedCount, failed: failedCount, skipped: skippedCount, total: tests.length },
  e2eNote: passed ? "LIVE E2E PASSED" : partial ? "LIVE E2E PARTIAL" : "LIVE E2E FAILED",
  failureCoverage:
    tests.some((t) => /question/i.test(t.name) && t.passed) &&
    (tests.some((t) => /insufficient|credits/i.test(t.name) && t.passed) ||
      tests.some((t) => /repair|failure/i.test(t.name) && t.passed)),
});

if (passed) {
  console.log("\n════════════════════════════════════════════");
  console.log("  LIVE E2E PASSED");
  console.log("════════════════════════════════════════════\n");
} else {
  console.error("\n════════════════════════════════════════════");
  console.error("  LIVE E2E FAILED");
  console.error("════════════════════════════════════════════\n");
}

process.exit(r.status ?? 1);
