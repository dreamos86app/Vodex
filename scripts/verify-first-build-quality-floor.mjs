#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const errors = [];
const plan = read("src/lib/build/full-app-generation-plan.ts");
if (!plan.includes("minQualityScore: 84")) errors.push("medium quality floor 84");
if (!plan.includes("minFiles: 40")) errors.push("medium min files");

const pipeline = read("src/lib/build/build-pipeline.ts");
if (!pipeline.includes("renderableCount >= generationBudget.minFiles")) {
  errors.push("pipeline min files gate");
}
if (!pipeline.includes("buildFinalSummary")) errors.push("final summary");

const worker = read("src/lib/build/execute-staged-build-job.ts");
if (!worker.includes("qualityBlocked")) errors.push("worker quality blocked");
if (!worker.includes("minMeaningfulFiles")) errors.push("worker min meaningful files");

if (errors.length) {
  console.error("verify:first-build-quality-floor FAILED\n", errors.join("\n"));
  process.exit(1);
}
console.log("verify:first-build-quality-floor OK");
