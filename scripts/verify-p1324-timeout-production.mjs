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
  "no-timeout-retry-loop": () => {
    const errors = [];
    const pipeline = read("src/lib/build/build-pipeline.ts");
    must(read("src/lib/build/model-timeout-strategy.ts"), "MAX_SAME_STAGE_TIMEOUTS = 2", "stage timeout cap", errors);
    must(pipeline, "MAX_USER_CONTINUATION_PASSES = 2", "continuation pass cap", errors);
    must(pipeline, "runRouteByRouteGeneration", "route-by-route fallback in pipeline", errors);
    mustNot(pipeline, "Retry ${continuationAttemptsTotal}/${MAX_SAFE_CONTINUATION_ATTEMPTS}", "no retry X/6 user copy", errors);
    mustNot(pipeline, "Continuation pass ${continuationPass + 1} timed out", "no continuation pass timeout copy", errors);
    return errors;
  },
  "route-by-route-generation-fallback": () => {
    const errors = [];
    must(read("src/lib/build/route-by-route-generation.ts"), "runRouteByRouteGeneration", "route-by-route runner", errors);
    must(read("src/lib/build/route-by-route-generation.ts"), "recordModelTimeout", "timeout strategy in rbr", errors);
    must(read("src/lib/build/build-pipeline.ts"), "routeByRouteOnly", "route-by-route flag", errors);
    must(read("src/lib/build/build-pipeline.ts"), "resumeContinuation", "resume continuation flag", errors);
    return errors;
  },
  "no-quality-debug-user-chat": () => {
    const errors = [];
    must(read("src/lib/build/build-user-copy.ts"), "sanitizeUserBuildChatText", "sanitize helper", errors);
    must(read("src/lib/build/workflow-stream-coalesce.ts"), "quality\\s*score", "filter quality in coalesce", errors);
    mustNot(read("src/lib/build/execute-staged-build-job.ts"), "Quality score:", "no quality in worker", errors);
    mustNot(read("src/lib/build/live-build-activity.ts"), "Retry ${n}/${maxAttempts}", "no retry quality in activity", errors);
    must(read("src/lib/build/live-build-activity.ts"), "Checking screens and navigation", "user-friendly quality phase", errors);
    return errors;
  },
  "no-duplicated-build-narration": () => {
    const errors = [];
    must(read("src/lib/build/workflow-stream-coalesce.ts"), "limitTerminalNarration", "terminal narration limit", errors);
    must(read("src/lib/build/workflow-stream-coalesce.ts"), "collapseDuplicateAssistantMessages", "dedupe assistant", errors);
    must(read("src/components/create/workspace/agent-workflow-stream.tsx"), "limitTerminalNarration", "limit wired in stream", errors);
    must(read("src/components/create/workspace/agent-workflow-stream.tsx"), "unique.slice(-3)", "cap narration copy", errors);
    return errors;
  },
  "continue-generation-resumes": () => {
    const errors = [];
    must(read("src/lib/chat/create-chat-transport.ts"), "resumeContinuation", "transport flag", errors);
    must(read("src/lib/create/async-build-client.ts"), "resumeContinuation", "async client flag", errors);
    must(read("src/app/api/chat/route.ts"), "resumeContinuation", "api route flag", errors);
    must(read("src/lib/build/execute-staged-build-job.ts"), "routeByRouteOnly: input.resumeContinuation", "worker resumes rbr", errors);
    must(read("src/components/create/workspace/immersive-workspace.tsx"), "resumeContinuation: true", "continue CTA enqueues resume", errors);
    must(read("src/lib/build/build-continuation-state.ts"), "build_continuation", "continuation state", errors);
    return errors;
  },
  "no-repair-for-paused-new-build": () => {
    const errors = [];
    must(read("src/lib/build/app-build-truth.ts"), "showRepair", "showRepair gate", errors);
    must(read("src/lib/build/app-build-truth.ts"), "isIncompleteNewBuild", "incomplete new build", errors);
    must(read("src/lib/build/build-user-copy.ts"), "BUILD_PAUSED_HEADLINE", "paused headline", errors);
    must(read("src/components/create/workspace/build-run-summary.tsx"), "summary-continue-generation", "continue CTA", errors);
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
