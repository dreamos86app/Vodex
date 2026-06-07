#!/usr/bin/env node
/**
 * P1.3.14 — Static verification for full-app generation quality pipeline.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function must(src, needle, label, errors) {
  if (!src.includes(needle)) errors.push(label);
}

function mustExist(rel, errors) {
  if (!fs.existsSync(path.join(root, rel))) errors.push(`missing file: ${rel}`);
}

const errors = [];

for (const rel of [
  "src/lib/build/full-app-generation-plan.ts",
  "src/lib/build/generated-app-quality-score.ts",
  "src/lib/build/route-connectivity-check.ts",
  "src/lib/build/generation-continuation.ts",
  "src/lib/build/app-specific-language-check.ts",
]) {
  mustExist(rel, errors);
}

const plan = read("src/lib/build/full-app-generation-plan.ts");
must(plan, "minFiles: 25", "simple tier min files", errors);
must(plan, "minFiles: 40", "medium tier min files", errors);
must(plan, "minFiles: 65", "complex tier min files", errors);

const pipeline = read("src/lib/build/build-pipeline.ts");
must(pipeline, "scoreGeneratedAppQuality", "pipeline quality scoring", errors);
must(pipeline, "shouldContinueGeneration", "pipeline continuation", errors);
must(pipeline, "buildContinuationFrontendPrompt", "continuation prompt", errors);
must(pipeline, "model_files_count", "scaffold telemetry", errors);

const scope = read("src/lib/build/first-pass-scope.ts");
must(scope, "resolveFullAppGenerationPlan", "scope uses full app plan", errors);
must(scope, "Model generates all UI", "model-first scope note", errors);

const fallback = read("src/lib/build/archetype-scaffold-fallback.ts");
must(fallback, "Model-first", "model-first scaffold guard", errors);

const staged = read("src/lib/build/execute-staged-build-job.ts");
must(staged, "generationQualityReport", "staged job quality gate", errors);
must(staged, "Build complete", "honest completion title", errors);

const language = read("src/lib/build/app-specific-language-check.ts");
must(language, "metrics,\\s*workflows,\\s*and team tools", "generic shell detection", errors);

if (errors.length) {
  console.error("verify:generated-app-quality FAILED");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log("verify:generated-app-quality OK");
