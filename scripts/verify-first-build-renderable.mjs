#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const must = (rel, needle, label) => {
  if (!fs.readFileSync(path.join(root, rel), "utf8").includes(needle)) errors.push(label);
};

must("src/lib/preview/inject-preview-router-shim.ts", "replaceState", "router shim");
must("src/lib/preview/rewrite-preview-artifact-html.ts", "injectPreviewRouterShim", "shim in rewrite");
must("src/app/api/projects/[id]/preview/import-status/route.ts", "applyPreviewBuildToProject", "sync on first success");
must("src/lib/preview/load-preview-runtime-status.ts", "preview_renderable", "job renderable in status");
must("worker/preview-worker/src/job-runner.ts", "applyProjectMetadata", "worker syncs project meta");

if (errors.length) {
  console.error("verify:first-build-renderable FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:first-build-renderable OK");
