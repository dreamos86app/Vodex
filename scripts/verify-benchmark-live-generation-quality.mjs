#!/usr/bin/env node
/** P1.3.15 — Benchmark hooks for live generation quality (static wiring check). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const errors = [];
const plan = read("src/lib/build/full-app-generation-plan.ts");
if (!plan.includes("minQualityScore: 78")) errors.push("simple threshold 78");
if (!plan.includes("minQualityScore: 84")) errors.push("medium threshold 84");
if (!plan.includes("minQualityScore: 88")) errors.push("complex threshold 88");

const pipeline = read("src/lib/build/build-pipeline.ts");
if (!pipeline.includes("meaningfulQualityReport")) errors.push("meaningful report in pipeline");

const worker = read("src/lib/build/execute-staged-build-job.ts");
if (!worker.includes("quality_warning")) errors.push("preview quality warning");

if (errors.length) {
  console.error("benchmark:live-generation-quality FAILED\n", errors.join("\n"));
  process.exit(1);
}
console.log("benchmark:live-generation-quality OK (static wiring)");
