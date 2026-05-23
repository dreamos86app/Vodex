#!/usr/bin/env node
import fs from "node:fs";
import {
  EVIDENCE_PATH,
  BENCHMARK_RESULTS_PATH,
  writeBenchmarkMarkdown,
  loadEvidence,
  loadPreferredBenchmarkResult,
  applyBenchmarkToEvidence,
  liveBenchmarkProofValid,
  loadBenchmarkFile,
  BENCHMARK_RESULTS_LIVE_PATH,
} from "./lib/e2e-live.mjs";

const preferred = loadPreferredBenchmarkResult();
if (!preferred) {
  console.error("✗ Run npm run benchmark:smoke first");
  process.exit(1);
}

const { result, source } = preferred;
const evidence = loadEvidence();
applyBenchmarkToEvidence(evidence, result, source);

fs.writeFileSync(EVIDENCE_PATH, JSON.stringify(evidence, null, 2));
const mdPath = writeBenchmarkMarkdown({ ...result, smokePassed: evidence.benchmarkReport.smokePassed });

console.log("\n=== benchmark:score ===\n");
console.log(`Mode: ${result.mode}`);
console.log(`Evidence source: ${evidence.benchmarkEvidenceSource ?? source}`);
console.log(`Live: ${evidence.benchmarkReport.live}`);
console.log(`Smoke passed: ${evidence.benchmarkReport.smokePassed}`);
console.log(`Build success: ${((result.buildSuccessRate ?? 0) * 100).toFixed(1)}%`);
console.log(`Placeholder rate: ${((result.placeholderRate ?? 1) * 100).toFixed(1)}%`);
console.log(`Average UI quality: ${(result.averageQualityScore ?? 0).toFixed(1)}`);
if (result.reason) console.log(`Note: ${result.reason}`);
if (fs.existsSync(BENCHMARK_RESULTS_PATH)) {
  console.log(`Latest artifact: ${BENCHMARK_RESULTS_PATH}`);
}
if (liveBenchmarkProofValid(loadBenchmarkFile(BENCHMARK_RESULTS_LIVE_PATH))) {
  console.log(`Live proof preserved: ${BENCHMARK_RESULTS_LIVE_PATH}`);
}
console.log(`\n✓ Updated ${EVIDENCE_PATH}`);
console.log(`✓ Updated ${mdPath}`);
process.exit(0);
