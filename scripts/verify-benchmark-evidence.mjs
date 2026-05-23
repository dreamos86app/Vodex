#!/usr/bin/env node
/**
 * Ensures live benchmark proof survives structure runs and verify:all.
 */
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import {
  ROOT,
  EVIDENCE_PATH,
  BENCHMARK_RESULTS_LIVE_PATH,
  BENCHMARK_RESULTS_STRUCTURE_PATH,
  loadBenchmarkFile,
  loadPreferredBenchmarkResult,
  liveBenchmarkProofValid,
  loadEvidence,
} from "./lib/e2e-live.mjs";

const errors = [];

function assert(cond, msg) {
  if (!cond) errors.push(msg);
}

console.log("\n=== verify:benchmark-evidence ===\n");

const liveBefore = loadBenchmarkFile(BENCHMARK_RESULTS_LIVE_PATH);
const hadLiveProof = liveBenchmarkProofValid(liveBefore);

if (hadLiveProof) {
  console.log(`✓ Live artifact present (${BENCHMARK_RESULTS_LIVE_PATH})`);
  console.log(
    `  smokePassed=${liveBefore.smokePassed} avgUI=${(liveBefore.averageQualityScore ?? 0).toFixed(1)} placeholder=${((liveBefore.placeholderRate ?? 1) * 100).toFixed(1)}%`,
  );
} else {
  console.log("Note: no live benchmark artifact yet — run BENCHMARK_LIVE=1 npm run benchmark:smoke");
}

console.log("\n--- structure benchmark must not erase live file ---\n");
const structureRun = spawnSync("npm", ["run", "benchmark:smoke"], {
  cwd: ROOT,
  shell: true,
  encoding: "utf8",
  env: { ...process.env, BENCHMARK_LIVE: "", E2E_RUN_LIVE: "" },
});

assert(structureRun.status === 0, "structure benchmark:smoke failed");

const liveAfterStructure = loadBenchmarkFile(BENCHMARK_RESULTS_LIVE_PATH);
const structureAfter = loadBenchmarkFile(BENCHMARK_RESULTS_STRUCTURE_PATH);

assert(fs.existsSync(BENCHMARK_RESULTS_STRUCTURE_PATH), "structure artifact missing after smoke");
assert(
  structureAfter?.mode === "structure_fixtures" || structureAfter?.mode === "structure_only",
  "structure artifact has unexpected mode",
);

if (hadLiveProof) {
  assert(liveAfterStructure !== null, "live artifact was deleted by structure benchmark");
  assert(
    liveBenchmarkProofValid(liveAfterStructure),
    "live artifact lost smokePassed or quality after structure run",
  );
  assert(
    (liveAfterStructure.averageQualityScore ?? 0) === (liveBefore.averageQualityScore ?? 0),
    "live averageQualityScore changed after structure run",
  );
  assert(liveAfterStructure.smokePassed === true, "live smokePassed no longer true after structure run");
  console.log("✓ Live artifact unchanged after structure benchmark:smoke");
} else {
  console.log("✓ Structure artifact written (no live proof to preserve)");
}

console.log("\n--- benchmark:score must prefer live when available ---\n");
const scoreRun = spawnSync("npm", ["run", "benchmark:score"], {
  cwd: ROOT,
  shell: true,
  encoding: "utf8",
});
assert(scoreRun.status === 0, "benchmark:score failed");

const evidence = loadEvidence();
const preferred = loadPreferredBenchmarkResult();

if (hadLiveProof) {
  assert(evidence.benchmarkEvidenceSource === "live", "evidence.benchmarkEvidenceSource is not live");
  assert(evidence.benchmarkReport?.live === true, "evidence.benchmarkReport.live is not true");
  assert(evidence.benchmarkReport?.smokePassed === true, "evidence.benchmarkReport.smokePassed is not true");
  assert(preferred?.source === "live", "loadPreferredBenchmarkResult did not pick live");
  assert(
    (evidence.benchmarkReport?.averageQualityScore ?? 0) >= 80,
    "evidence averageQualityScore below live threshold",
  );
  console.log(`✓ Scoreboard reads live proof (avg UI ${(evidence.benchmarkReport.averageQualityScore ?? 0).toFixed(1)})`);
} else if (preferred) {
  assert(preferred.source === "structure", "expected structure source when no live proof");
  console.log("✓ Scoreboard reads structure (no live artifact)");
}

if (errors.length) {
  console.error("\n✗ verify:benchmark-evidence failed\n");
  errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
}

console.log("\n✓ verify:benchmark-evidence passed\n");
process.exit(0);
