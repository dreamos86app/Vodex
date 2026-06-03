#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const must = (rel, needle, label) => {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) {
    errors.push(`missing file: ${rel}`);
    return;
  }
  const src = fs.readFileSync(p, "utf8");
  if (!src.includes(needle)) errors.push(label);
};

const modules = [
  "src/lib/imports/analyze-imported-project.ts",
  "src/lib/imports/framework-detector.ts",
  "src/lib/imports/import-sandbox.ts",
  "src/lib/imports/runtime-build-runner.ts",
  "src/lib/imports/preview-artifact-writer.ts",
  "src/lib/imports/preview-health-check.ts",
  "src/lib/imports/base44-lovable-adapter.ts",
  "src/lib/imports/import-diagnostics.ts",
  "src/lib/imports/run-project-preview-build.ts",
];

for (const m of modules) {
  if (!fs.existsSync(path.join(root, m))) errors.push(`missing module ${m}`);
}

must("src/lib/imports/runtime-build-runner.ts", "canExecuteNpmPreviewBuild", "npm build gate");
must("src/lib/imports/runtime-build-runner.ts", "checkPreviewHealth", "health validation");
must("src/lib/imports/preview-health-check.ts", "previewRenderable", "renderable flag");
must("src/lib/import/imported-app-validator.ts", "previewReady = false", "no fake preview on validate");
must("src/app/api/projects/import-zip/route.ts", "runProjectPreviewBuild", "import triggers build");
must("src/app/api/projects/[id]/preview/build/route.ts", "runProjectPreviewBuild", "rebuild route");
must("supabase/migrations/20260803120000_p30_zip_preview_runtime_worker.sql", "preview_build_jobs", "jobs table migration");
must("supabase/migrations/20260804120000_p31_dedicated_preview_worker.sql", "claim_preview_build_job", "P31 worker lock");
must("src/lib/imports/preview-build-queue.ts", "queuePreviewBuildJob", "worker queue");

if (errors.length) {
  console.error("verify:preview-runtime-worker FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:preview-runtime-worker OK");
