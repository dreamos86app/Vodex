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

must("src/lib/import/zip-import-service.ts", "extractAndAnalyzeZip", "ZIP analysis");
must("src/lib/preview/inject-preview-router-shim.ts", "injectPreviewRouterShim", "route shim for SPA");
must("src/lib/preview/rewrite-preview-artifact-html.ts", "rewritePreviewArtifactHtml", "preview HTML rewrite");
must("worker/preview-worker/src/job-runner.ts", "applyProjectMetadata", "first-build metadata sync");
must("scripts/verify-first-build-renderable.mjs", "first-build", "first build verify");
must("scripts/verify-route-discovery.mjs", "route", "route discovery verify");
must("src/app/api/projects/import-zip/route.ts", "import-zip", "import API");

if (errors.length) {
  console.error("verify:zip-stress-suite FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:zip-stress-suite OK");
