#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const errors = [];
if (!fs.existsSync(path.join(root, "src/lib/build/generic-scaffold-detector.ts"))) {
  errors.push("missing generic-scaffold-detector.ts");
}

const detector = read("src/lib/build/generic-scaffold-detector.ts");
for (const n of ["MetricCard", "generic_item_status_updated_table", "sixteen_file_scaffold_shape"]) {
  if (!detector.includes(n)) errors.push(`detector: ${n}`);
}

const pipeline = read("src/lib/build/build-pipeline.ts");
if (!pipeline.includes("detectGenericScaffoldBuild")) errors.push("pipeline detector");
if (!pipeline.includes("Blocked generic scaffold")) errors.push("pipeline blocks generic scaffold");
if (!pipeline.includes("allowFullScaffold: smokeBuild")) errors.push("scaffold opts smoke only");

const fallback = read("src/lib/build/archetype-scaffold-fallback.ts");
if (!fallback.includes("allowFullScaffold === true")) errors.push("full scaffold opt-in only");
if (!fallback.includes("isProductionBuildMode()")) errors.push("production scaffold guard");

const worker = read("src/lib/build/execute-staged-build-job.ts");
if (!worker.includes("failed_draft")) errors.push("failed_draft not persisted as app");
if (!worker.includes("quality_blocked_failed_draft")) errors.push("clears files on quality block");

if (!worker.includes("generic_scaffold_detected")) errors.push("worker generic gate");

if (errors.length) {
  console.error("verify:no-generic-scaffold-build FAILED\n", errors.join("\n"));
  process.exit(1);
}
console.log("verify:no-generic-scaffold-build OK");
