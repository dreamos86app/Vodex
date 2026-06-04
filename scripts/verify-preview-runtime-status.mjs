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

must(
  "src/app/api/projects/[id]/preview/runtime-status/route.ts",
  "loadPreviewRuntimeStatus",
  "runtime-status API",
);
must("src/components/create/workspace/preview-panel.tsx", "PreviewRuntimeStatusPanel", "preview panel blocked state UI");
must("src/components/create/workspace/preview-runtime-status-panel.tsx", "PreviewRuntimeStatusPanel", "runtime status panel");
must("src/lib/preview/preview-phase-message.ts", "previewPhaseHeadline", "phase messages");

const route = fs.readFileSync(
  path.join(root, "src/app/api/projects/[id]/preview/runtime-status/route.ts"),
  "utf8",
);
for (const field of [
  "jobId",
  "state",
  "workerId",
  "framework",
  "artifactReady",
  "renderable",
  "blockedReason",
  "buildLogTail",
]) {
  if (!route.includes(field)) errors.push(`runtime-status response missing ${field}`);
}

if (!fs.readFileSync(path.join(root, "package.json"), "utf8").includes("verify:preview-runtime-status")) {
  errors.push("verify script not registered");
}

if (errors.length) {
  console.error("verify:preview-runtime-status FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:preview-runtime-status OK");
