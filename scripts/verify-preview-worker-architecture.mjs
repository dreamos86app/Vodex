#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const must = (rel, needle, label) => {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) {
    errors.push(`missing: ${rel}`);
    return;
  }
  if (!fs.readFileSync(p, "utf8").includes(needle)) errors.push(label);
};

const workerFiles = [
  "worker/preview-worker/src/index.ts",
  "worker/preview-worker/src/job-runner.ts",
  "worker/preview-worker/src/config.ts",
  "worker/preview-worker/Dockerfile",
  "worker/preview-worker/README.md",
];
for (const f of workerFiles) {
  if (!fs.existsSync(path.join(root, f))) errors.push(`missing ${f}`);
}

must("src/lib/imports/preview-build-queue.ts", "queuePreviewBuildJob", "queue helper");
must("src/lib/imports/preview-source-snapshot.ts", "preview-sources", "source snapshot bucket");
must("src/lib/imports/runtime-build-runner.ts", "queuePreviewBuildJob", "vercel queues worker");
must("supabase/migrations/20260804120000_p31_dedicated_preview_worker.sql", "claim_preview_build_job", "atomic lock RPC");
must("package.json", "preview-worker:dev", "root worker dev script");
must("package.json", "verify:preview-worker-architecture", "verify script registered");

if (errors.length) {
  console.error("verify:preview-worker-architecture FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:preview-worker-architecture OK");
