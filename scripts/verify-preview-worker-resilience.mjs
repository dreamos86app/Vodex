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

must("worker/preview-worker/start.sh", "unset NODE_OPTIONS", "worker unsets bad NODE_OPTIONS");
must("worker/preview-worker/src/job-runner.ts", "applyProjectMetadata", "job metadata sync");
must("worker/preview-worker/src/job-runner.ts", "finishJob", "finishJob lifecycle");
must("scripts/verify-preview-worker-node-options.mjs", "NODE_OPTIONS", "node options verify script");

if (errors.length) {
  console.error("verify:preview-worker-resilience FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:preview-worker-resilience OK");
