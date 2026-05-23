#!/usr/bin/env node
/**
 * Benchmark scale runner — half (25) or full (50) prompts.
 * Structure mode: blueprint scoring only (no fake live pass).
 * Live mode: BENCHMARK_LIVE=1 + --live runs real API builds via run-live-benchmark.ts
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  ROOT,
  writeBenchmarkArtifact,
  loadEvidence,
  writeEvidence,
  applyBenchmarkToEvidence,
  BENCHMARK_RESULTS_PATH,
} from "./lib/e2e-live.mjs";

import { runTsxScript } from "./lib/run-tsx.mjs";

const argv = process.argv.slice(2);
const modeArg = argv.includes("--full") ? "full" : "half";
const live = process.env.BENCHMARK_LIVE === "1" && argv.includes("--live");
const promptCount = modeArg === "full" ? 50 : 25;

const buildR = spawnSync("node", [path.join(ROOT, "scripts/build-benchmark-50.mjs")], {
  cwd: ROOT,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});
if (buildR.stdout) process.stdout.write(buildR.stdout);
if (buildR.stderr) process.stderr.write(buildR.stderr);
if (buildR.status !== 0) process.exit(buildR.status ?? 1);

function runNpxTsx(scriptRel, args = [], timeoutMs = 120_000) {
  return runTsxScript(scriptRel, args, { timeout: timeoutMs });
}

function parseLastJson(stdout) {
  const text = `${stdout ?? ""}`.trim();
  const start = text.lastIndexOf('{"runAt"');
  if (start >= 0) {
    try {
      return JSON.parse(text.slice(start));
    } catch {
      /* fall through */
    }
  }
  const jsonStart = text.lastIndexOf("{");
  if (jsonStart < 0) return null;
  return JSON.parse(text.slice(jsonStart));
}

let result;

if (live) {
  const extraArgs = [
    modeArg === "full" ? "--full" : "--half",
    "--live",
    ...argv.filter((a) => a.startsWith("--concurrency=") || a.startsWith("--max-cost-usd=")),
    ...(argv.includes("--resume") ? ["--resume"] : []),
    ...(argv.includes("--stop-on-fail") ? ["--stop-on-fail"] : []),
    ...(argv.includes("--archive-projects") ? ["--archive-projects"] : []),
    ...(argv.includes("--keep-projects") ? ["--keep-projects"] : []),
  ];
  const runR = runNpxTsx("scripts/run-live-benchmark.ts", extraArgs, 3_600_000);
  if (runR.stderr) process.stderr.write(runR.stderr);
  try {
    result = parseLastJson(runR.stdout);
  } catch (e) {
    console.error("Failed to parse live benchmark output:", e);
    process.exit(1);
  }
  if (!result) {
    console.error(runR.stderr || runR.stdout || "run-live-benchmark failed");
    process.exit(runR.status ?? 1);
  }
} else {
  const scoreR = runNpxTsx("scripts/benchmark-blueprint-score.ts");
  let blueprintMetrics = { averageBlueprintScore: 0, templateInfluenceRate: 0, backendPlanCompleteness: 0, promptCount: 50 };
  if (scoreR.status === 0) {
    const jsonStart = (scoreR.stdout ?? "").indexOf("{");
    if (jsonStart >= 0) blueprintMetrics = JSON.parse(scoreR.stdout.slice(jsonStart));
  } else {
    console.error(scoreR.stderr || scoreR.stdout || "benchmark-blueprint-score failed");
    process.exit(scoreR.status ?? 1);
  }
  result = {
    runAt: new Date().toISOString(),
    mode: "structure_readiness",
    scale: modeArg,
    promptCount,
    live: false,
    reason: `Structure-only: blueprint avg ${blueprintMetrics.averageBlueprintScore}. Use BENCHMARK_LIVE=1 npm run benchmark:${modeArg} -- --live for real builds.`,
    averageBlueprintScore: blueprintMetrics.averageBlueprintScore,
    templateInfluenceRate: blueprintMetrics.templateInfluenceRate,
    backendPlanCompleteness: blueprintMetrics.backendPlanCompleteness,
    buildSuccessRate: 0,
    previewSuccessRate: 0,
    publishReadinessRate: 0,
    placeholderRate: 1,
    averageQualityScore: blueprintMetrics.averageBlueprintScore,
    smokePassed: false,
    halfBenchmarkReady: modeArg === "half",
    fullBenchmarkReady: false,
    results: [],
  };
}

writeBenchmarkArtifact(result);
const mdName = modeArg === "full" ? "benchmark-50-report.md" : "benchmark-half-report.md";
const mdPath = path.join(ROOT, "benchmarks/reports", mdName);
fs.mkdirSync(path.dirname(mdPath), { recursive: true });
fs.writeFileSync(
  mdPath,
  `# Benchmark ${modeArg}\n\n- Prompts: ${result.promptCount ?? 0}\n- Mode: ${result.mode}\n- Live: ${result.live ?? false}\n- Build success: ${((result.buildSuccessRate ?? 0) * 100).toFixed(1)}%\n- UI validation: ${((result.uiValidationRate ?? 0) * 100).toFixed(1)}%\n- Avg UI quality: ${(result.averageQualityScore ?? 0).toFixed(1)}\n- Avg blueprint: ${(result.averageBlueprintScore ?? 0).toFixed(1)}\n- Template influence: ${((result.templateInfluenceRate ?? 0) * 100).toFixed(0)}%\n- Placeholder rate: ${((result.placeholderRate ?? 1) * 100).toFixed(1)}%\n\n${result.reason ?? ""}\n`,
);

const evidence = loadEvidence();
applyBenchmarkToEvidence(evidence, result, live && result.live ? "live" : "structure");
if (result.averageBlueprintScore != null) {
  evidence.benchmarkStructureReport = {
    ...(evidence.benchmarkStructureReport ?? {}),
    averageBlueprintScore: result.averageBlueprintScore,
    templateInfluenceRate: result.templateInfluenceRate,
    backendPlanCompleteness: result.backendPlanCompleteness,
    halfBenchmarkReady: result.halfBenchmarkReady,
    fullBenchmarkReady: result.fullBenchmarkReady,
  };
}
writeEvidence(evidence);

console.log(`\n=== benchmark:${modeArg} ===\n`);
console.log(`Prompts: ${result.promptCount ?? 0}`);
console.log(`Mode: ${result.mode}`);
console.log(`Live builds: ${result.live === true ? "yes" : "no (structure only)"}`);
if (result.buildSuccessRate != null) console.log(`Build success: ${(result.buildSuccessRate * 100).toFixed(1)}%`);
if (result.averageQualityScore != null) console.log(`Avg UI quality: ${result.averageQualityScore.toFixed(1)}`);
if (result.averageBlueprintScore != null) console.log(`Avg blueprint score: ${result.averageBlueprintScore.toFixed(1)}`);
console.log(`Smoke passed: ${result.smokePassed}`);
console.log(`Wrote ${BENCHMARK_RESULTS_PATH}`);
console.log(`Wrote ${mdPath}`);
if (!live) {
  console.log("\nNote: Structure-only run. Use BENCHMARK_LIVE=1 npm run benchmark:half -- --live for real builds.");
}
process.exit(result.smokePassed === false && live && argv.includes("--stop-on-fail") ? 1 : 0);
