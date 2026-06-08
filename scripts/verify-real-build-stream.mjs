#!/usr/bin/env node
/** P1.3.15 — Real build stream / extraction streaming verification */
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

const errors = [];

for (const rel of [
  "src/lib/build/canonical-build-stages.ts",
  "src/lib/build/build-stage-orchestrator.ts",
  "src/lib/build/extraction-file-stream.ts",
]) {
  if (!fs.existsSync(path.join(root, rel))) errors.push(`missing: ${rel}`);
}

const pipeline = read("src/lib/build/build-pipeline.ts");
must(pipeline, "ingestModelFilesWithExtractionStream", "extraction stream ingest", errors);
must(pipeline, "streamExtractBuildFiles", "extraction stream import", errors);
must(pipeline, "runBuildStage", "stage orchestrator", errors);
must(pipeline, "extraction_stream: true", "extraction stream metadata", errors);

const stream = read("src/components/create/workspace/agent-workflow-stream.tsx");
must(stream, "DreamOSMessageShell", "assistant chrome shell", errors);
must(stream, "compressFileEventsForDisplay", "file compression during build", errors);
if (stream.includes(".slice(-32)")) errors.push("timeline still crops to 32 items");

const progress = read("src/hooks/use-build-job-progress.ts");
must(progress, "MAX_CLIENT_EVENTS = 600", "expanded event history cap", errors);

if (errors.length) {
  console.error("verify:real-build-stream FAILED\n", errors.join("\n"));
  process.exit(1);
}
console.log("verify:real-build-stream OK");
