#!/usr/bin/env node
/**
 * P0 live proof gate — runs auth verify, live E2E, live benchmark, writes evidence.
 * Does NOT inflate scores; structure-only paths are never marked as live proof.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { withSafeTlsEnv } from "./lib/tls-env.mjs";
import {
  ROOT,
  getBaseUrl,
  serverUp,
  authFileExists,
  writeEvidence,
  loadEvidence,
  parsePlaywrightReport,
  BENCHMARK_RESULTS_PATH,
  EVIDENCE_PATH,
  BENCHMARK_MD_PATH,
} from "./lib/e2e-live.mjs";

const verifyEnv = withSafeTlsEnv(process.env);

console.log("\n╔══════════════════════════════════════════╗");
console.log("║  DreamOS86 — prove:live (P0 gate)        ║");
console.log("╚══════════════════════════════════════════╝\n");

const summary = {
  startedAt: new Date().toISOString(),
  baseUrl: getBaseUrl(),
  authFileExisted: authFileExists(),
  devServerUp: false,
  steps: [],
  liveE2eRan: false,
  liveE2ePassed: false,
  liveBenchmarkRan: false,
  liveBenchmarkPassed: false,
  failedTests: [],
  skippedTests: [],
};

function runStep(name, cmd, env = verifyEnv) {
  console.log(`\n--- ${name} ---\n`);
  const r = spawnSync(cmd, { cwd: ROOT, shell: true, stdio: "inherit", env });
  summary.steps.push({ name, cmd, exitCode: r.status ?? 1 });
  return r.status ?? 1;
}

async function main() {
  summary.devServerUp = await serverUp();
  if (!summary.devServerUp) {
    console.error(`✗ Dev server not running at ${summary.baseUrl}`);
    console.error("\n  npm run dev\n");
    writeEvidence({
      e2eMode: "live-skipped-no-server",
      e2eLiveProof: false,
      e2eNote: "prove:live blocked — dev server not running",
    });
    printSummary();
    process.exit(1);
  }
  console.log(`✓ Dev server up (${summary.baseUrl})`);
  console.log(`  auth file: ${summary.authFileExisted ? "present" : "MISSING"}`);

  if (runStep("verify:e2e-auth", "npm run verify:e2e-auth", verifyEnv) !== 0) {
    writeEvidence({
      e2eMode: "live-skipped-no-auth",
      e2eLiveProof: false,
      e2eNote: "prove:live blocked — auth missing or invalid",
    });
    printSummary();
    process.exit(1);
  }

  summary.liveE2eRan = true;
  const e2eCode = runStep(
    "test:e2e:live",
    "npm run test:e2e:live",
    { ...verifyEnv, E2E_RUN_LIVE: "1", PLAYWRIGHT_SKIP_SERVER: "1" },
  );

  const e2eTests = parsePlaywrightReport();
  summary.failedTests = e2eTests.filter((t) => t.failed);
  summary.skippedTests = e2eTests.filter((t) => t.skipped);
  summary.liveE2ePassed = e2eCode === 0;

  writeEvidence({
    e2eMode: summary.liveE2ePassed ? "live-passed" : "live-failed",
    e2ePassed: summary.liveE2ePassed,
    e2eLiveProof: summary.liveE2ePassed,
    e2eTests: e2eTests.map((t) => ({ name: t.name, passed: t.passed, skipped: t.skipped, status: t.status })),
    e2eNote: summary.liveE2ePassed ? "prove:live — LIVE E2E PASSED" : "prove:live — LIVE E2E FAILED",
    failureCoverage:
      summary.liveE2ePassed &&
      e2eTests.some((t) => /@live 01|question/i.test(t.name) && t.passed) &&
      (e2eTests.some((t) => /@live 11|repair/i.test(t.name) && t.passed) ||
        e2eTests.some((t) => /@live 08|credits/i.test(t.name) && t.passed)),
    proveLiveAt: new Date().toISOString(),
  });

  if (!summary.liveE2ePassed) {
    console.error("\n✗ Live E2E failed — benchmark still attempted if configured\n");
  }

  summary.liveBenchmarkRan = true;
  const benchCode = runStep(
    "benchmark:smoke (live)",
    "npm run benchmark:smoke",
    { ...verifyEnv, BENCHMARK_LIVE: "1", E2E_RUN_LIVE: "1" },
  );

  let benchResult = {};
  if (fs.existsSync(BENCHMARK_RESULTS_PATH)) {
    benchResult = JSON.parse(fs.readFileSync(BENCHMARK_RESULTS_PATH, "utf8"));
  }
  summary.liveBenchmarkPassed =
    benchResult.mode === "live_passed" &&
    (benchResult.buildSuccessRate ?? 0) >= 0.8 &&
    (benchResult.placeholderRate ?? 1) <= 0.1;

  runStep("benchmark:score", "npm run benchmark:score", verifyEnv);
  runStep("verify:competitive-score", "npm run verify:competitive-score", verifyEnv);

  const evidence = loadEvidence();
  writeEvidence({
    ...evidence,
    proveLiveSummary: {
      ...summary,
      finishedAt: new Date().toISOString(),
      benchmarkMode: benchResult.mode,
      benchmarkSmokePassed: evidence.benchmarkReport?.smokePassed ?? false,
    },
  });

  printSummary(benchResult);
  const failed = !summary.liveE2ePassed || benchCode !== 0;
  process.exit(failed ? 1 : 0);
}

function printSummary(benchResult = {}) {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║  prove:live summary                      ║");
  console.log("╚══════════════════════════════════════════╝\n");
  console.log(`  .playwright-auth.json: ${summary.authFileExisted ? "yes" : "no"}`);
  console.log(`  Dev server:            ${summary.devServerUp ? "up" : "down"}`);
  console.log(`  Live E2E ran:          ${summary.liveE2eRan ? "yes" : "no"}`);
  console.log(`  Live E2E passed:       ${summary.liveE2ePassed ? "yes" : "no"}`);
  console.log(`  Live benchmark ran:    ${summary.liveBenchmarkRan ? "yes" : "no"}`);
  console.log(`  Benchmark mode:        ${benchResult.mode ?? "unknown"}`);
  console.log(`  Evidence:              ${EVIDENCE_PATH}`);
  console.log(`  Benchmark JSON:        ${BENCHMARK_RESULTS_PATH}`);
  console.log(`  Benchmark MD:          ${BENCHMARK_MD_PATH}`);

  if (summary.failedTests.length) {
    console.log("\n  Failed tests:");
    for (const t of summary.failedTests) console.log(`    ✗ ${t.name}`);
  }
  if (summary.skippedTests.length) {
    console.log("\n  Skipped tests:");
    for (const t of summary.skippedTests) console.log(`    ○ ${t.name}`);
  }

  const ev = loadEvidence();
  console.log("\n  Score caps (honest):");
  console.log(`    live E2E proof:     ${ev.e2eLiveProof ? "YES — user flows can exceed 85" : "NO — cap 85"}`);
  console.log(`    live benchmark:     ${ev.benchmarkReport?.live && ev.benchmarkReport?.smokePassed ? "YES" : "NO — generated UI capped"}`);
  console.log(`    failure coverage:   ${ev.failureCoverage && ev.e2eLiveProof ? "YES" : "structure-only or missing"}`);
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
