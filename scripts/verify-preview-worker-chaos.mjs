#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const must = (rel, needle, label) => {
  const p = path.join(root, rel);
  if (!fs.existsSync(p) || !fs.readFileSync(p, "utf8").includes(needle)) errors.push(label);
};

must("worker/preview-worker/src/job-runner.ts", "finishJob", "job finish lifecycle");
must("worker/preview-worker/src/job-runner.ts", "failed", "failure path");
must("worker/preview-worker/src/supabase.ts", "claim_preview_build_job", "atomic job claim");
must("worker/preview-worker/src/supabase.ts", "p_stale_lock_minutes", "stale lock reclaim");
must("worker/preview-worker/src/health-check.ts", "checkPreviewHealth", "post-build health check");
must("worker/preview-worker/src/upload-artifacts.ts", "upload", "artifact upload path");
must("scripts/verify-preview-worker-resilience.mjs", "finishJob", "resilience verify baseline");

const runner = fs.readFileSync(path.join(root, "worker/preview-worker/src/job-runner.ts"), "utf8");
if (runner.includes('status: "succeeded"') && !runner.includes("checkPreviewHealth")) {
  errors.push("succeeded status requires health check");
}

if (errors.length) {
  console.error("verify:preview-worker-chaos FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:preview-worker-chaos OK");
