#!/usr/bin/env node
/** P1.3.15 — Meaningful UI quality gate */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const errors = [];
if (!fs.existsSync(path.join(root, "src/lib/build/meaningful-ui-quality.ts"))) {
  errors.push("missing meaningful-ui-quality.ts");
}

const quality = read("src/lib/build/meaningful-ui-quality.ts");
for (const needle of [
  "meaningful_routes",
  "placeholder_routes",
  "weak_file_paths",
  "generic_violet_scaffold",
  "final_quality_score",
]) {
  if (!quality.includes(needle)) errors.push(`quality module: ${needle}`);
}

const pipeline = read("src/lib/build/build-pipeline.ts");
if (!pipeline.includes("scoreMeaningfulUiQuality")) errors.push("pipeline meaningful score");
if (!pipeline.includes("meaningfulQualityReport.passes")) errors.push("meaningful pass gate");

const cont = read("src/lib/build/generation-continuation.ts");
if (!cont.includes("REWRITE these weak")) errors.push("continuation rewrite weak files");

if (errors.length) {
  console.error("verify:meaningful-ui-quality FAILED\n", errors.join("\n"));
  process.exit(1);
}
console.log("verify:meaningful-ui-quality OK");
