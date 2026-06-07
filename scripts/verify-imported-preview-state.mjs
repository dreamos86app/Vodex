#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const code = `
import { classifyImportedPreviewState } from "./src/lib/preview/imported-preview-state.ts";

const notStarted = classifyImportedPreviewState(
  { previewRenderable: false, previewStatus: "not_started", jobStatus: null, previewFailureKind: "no_preview_job" },
  { isImported: true, hasFiles: true },
);
if (notStarted.state !== "preview_not_started" || notStarted.showScaryBlocked) {
  throw new Error("imported not_started should not be scary");
}
if (!notStarted.showPrepareButton) throw new Error("should offer prepare");

const ready = classifyImportedPreviewState(
  { previewRenderable: true, previewStatus: "ready", jobStatus: "succeeded", previewFailureKind: null },
  { isImported: true, hasFiles: true },
);
if (ready.state !== "preview_ready") throw new Error("ready state");

console.log("verify:imported-preview-state passed");
`;

const r = spawnSync("npx", ["tsx", "--eval", code], { cwd: root, shell: true, encoding: "utf8" });
if (r.status !== 0) {
  console.error(r.stderr || r.stdout);
  process.exit(1);
}
console.log(r.stdout?.trim());
