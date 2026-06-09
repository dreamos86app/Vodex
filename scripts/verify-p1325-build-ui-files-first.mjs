#!/usr/bin/env node
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

function mustNot(src, needle, label, errors) {
  if (src.includes(needle)) errors.push(label);
}

const stream = read("src/components/create/workspace/agent-workflow-stream.tsx");

const errors = [];

must(stream, "BuildPhasedFilePanel", "phased file panel wired", errors);
must(stream, "BuildStepPhaseCard", "step phase card wired", errors);
must(stream, "BuildNoFilesYetCard", "no files yet card", errors);
must(stream, "BuildActiveWorkChip", "active work chip", errors);
mustNot(stream, "LiveBuildActivityPanel", "no live activity narration blob", errors);
mustNot(stream, "narrationCopy", "no narrationCopy blob", errors);
must(stream, "currentNarrationLine", "single narration line", errors);
must(stream, "isStructuralTimelineEvent", "hide narration timeline rows", errors);
must(read("src/lib/build/build-step-ui.ts"), "BUILD_STEP_RING_CLASS", "step outline colors", errors);
must(read("src/lib/ai/provider-timeouts.ts"), "SHELL_CHUNK_TIMEOUT_MS = 45_000", "shell chunk timeout", errors);
must(read("src/lib/build/chunked-generation-pipeline.ts"), "SHELL_CHUNK_TIMEOUT_MS", "shell timeout in chunks", errors);

if (errors.length) {
  console.error("FAIL build-ui-files-first");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log("OK build-ui-files-first");
