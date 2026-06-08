#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const errors = [];
const worker = read("src/lib/build/execute-staged-build-job.ts");
if (!worker.includes("modelUnderproduced")) errors.push("worker missing modelUnderproduced gate");
if (!worker.includes("model_underproduced")) errors.push("worker missing model_underproduced reason");
if (!worker.includes("failed_draft")) errors.push("worker must mark failed_draft");
if (!worker.includes("clearGeneratedBuildFiles")) errors.push("worker must clear files on block");

const summary = read("src/lib/build/build-final-summary.ts");
if (!summary.includes("Build paused — quality is below the production floor.")) {
  errors.push("build-final-summary missing quality pause copy");
}

const guards = read("src/lib/build/workflow-status-guards.ts");
if (!guards.includes("quality_below_floor")) errors.push("workflow guards missing quality_below_floor");

if (errors.length) {
  console.error("verify:underproduced-model-output-blocked FAILED\n", errors.join("\n"));
  process.exit(1);
}
console.log("verify:underproduced-model-output-blocked OK");
