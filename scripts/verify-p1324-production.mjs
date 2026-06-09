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

const suites = {
  "chunked-generation-pipeline": () => {
    const errors = [];
    must(read("src/lib/build/chunked-generation-pipeline.ts"), "generate_app_shell", "app shell chunk", errors);
    must(read("src/lib/build/chunked-generation-pipeline.ts"), "runChunkedFrontendGeneration", "chunk runner", errors);
    must(read("src/lib/build/build-pipeline.ts"), "runChunkedFrontendGeneration", "pipeline wired", errors);
    must(read("src/lib/build/chunked-generation-pipeline.ts"), "generate_final_polish", "final polish chunk", errors);
    return errors;
  },
  "model-call-timeout-failover": () => {
    const errors = [];
    must(read("src/lib/ai/provider-timeouts.ts"), "CHUNK_MODEL_TIMEOUT_MS = 25_000", "25s chunk timeout", errors);
    must(read("src/lib/build/chunked-model-call.ts"), "callChunkWithFailover", "failover helper", errors);
    must(read("src/lib/build/chunked-model-call.ts"), "buildSmallerPrompt", "smaller scope retry", errors);
    must(read("src/lib/build/build-pipeline.ts"), "CHUNK_MODEL_TIMEOUT_MS", "pipeline chunk timeout", errors);
    return errors;
  },
  "no-passive-model-wait-loop": () => {
    const errors = [];
    mustNot(read("src/lib/build/execute-staged-build-job.ts"), "Still waiting for", "no worker passive wait", errors);
    mustNot(read("src/lib/build/build-pipeline.ts"), "Still waiting for the model", "no pipeline passive wait", errors);
    must(read("src/lib/build/live-build-activity.ts"), "domainActiveWorkLines", "active work lines", errors);
    return errors;
  },
  "files-stream-per-chunk": () => {
    const errors = [];
    must(read("src/lib/build/chunked-generation-pipeline.ts"), "ingestChunk", "per-chunk ingest", errors);
    must(read("src/lib/build/build-pipeline.ts"), "chunk_complete", "chunk complete meta", errors);
    must(read("src/lib/build/build-pipeline.ts"), "onChunkComplete", "chunk complete hook", errors);
    return errors;
  },
  "build-active-work-narration": () => {
    const errors = [];
    must(read("src/lib/build/live-build-activity.ts"), "Generating dashboard layout", "dashboard active work", errors);
    must(read("src/components/create/workspace/live-build-activity-panel.tsx"), "chunk-progress-panel", "chunk progress UI", errors);
    must(read("src/lib/build/model-call-heartbeat.ts"), "activeWorkDuringChunk", "active heartbeat", errors);
    must(read("src/components/create/workspace/agent-workflow-stream.tsx"), "ChunkProgressPanel", "chunk progress wired", errors);
    return errors;
  },
};

const only = process.argv[2];
const names = only && only !== "all" ? [only] : Object.keys(suites);
let failed = 0;
for (const name of names) {
  const fn = suites[name];
  if (!fn) {
    console.error(`Unknown suite: ${name}`);
    failed++;
    continue;
  }
  const errors = fn();
  if (errors.length) {
    console.error(`FAIL ${name}`);
    for (const e of errors) console.error(`  - ${e}`);
    failed++;
  } else {
    console.log(`OK ${name}`);
  }
}
process.exit(failed ? 1 : 0);
