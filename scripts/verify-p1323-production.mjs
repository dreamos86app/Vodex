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
  "build-terminal-state-machine": () => {
    const errors = [];
    must(read("src/lib/build/build-terminal-state-machine.ts"), "preview_ready", "terminal phases", errors);
    must(read("src/lib/build/build-terminal-state-machine.ts"), "blocked_final", "blocked final", errors);
    must(read("src/lib/build/build-terminal-state-machine.ts"), "isTerminalBuildPhase", "terminal check", errors);
    must(read("src/lib/build/build-pipeline.ts"), "build_terminal_phase", "phase in pipeline", errors);
    must(read("src/lib/build/build-pipeline.ts"), "setBuildPhase", "set phase helper", errors);
    return errors;
  },
  "build-never-stalls-on-thin-route": () => {
    const errors = [];
    must(read("src/lib/build/build-pipeline.ts"), "targeted-rewrite", "targeted rewrite pass", errors);
    must(read("src/lib/build/build-pipeline.ts"), "MAX_SAFE_CONTINUATION_ATTEMPTS", "max attempts cap", errors);
    must(read("src/lib/build/build-pipeline.ts"), "running targeted rewrite next", "continue after failed cont", errors);
    mustNot(read("src/lib/build/build-pipeline.ts"), "if (!contCall.ok) break;", "no hard break on cont fail", errors);
    return errors;
  },
  "compact-live-activity-line": () => {
    const errors = [];
    must(read("src/components/create/workspace/live-build-activity-panel.tsx"), "compact-live-activity-line", "compact line", errors);
    must(read("src/lib/build/live-build-activity.ts"), 'mode: "compact"', "compact mode", errors);
    must(read("src/components/create/workspace/agent-workflow-stream.tsx"), 'variant="compact"', "compact variant wired", errors);
    return errors;
  },
  "build-watchdog-heartbeats": () => {
    const errors = [];
    must(read("src/lib/build/model-call-heartbeat.ts"), "activeWorkDuringChunk", "active work heartbeat", errors);
    must(read("src/lib/build/execute-staged-build-job.ts"), "10_000", "worker 10s watchdog", errors);
    must(read("src/lib/build/live-build-activity.ts"), "formatWatchdogHeartbeat", "heartbeat formatter", errors);
    return errors;
  },
  "build-final-summary-required": () => {
    const errors = [];
    must(read("src/lib/build/build-final-summary.ts"), "attempts", "attempts in summary", errors);
    must(read("src/components/create/workspace/live-build-activity-panel.tsx"), "build-final-summary", "summary block", errors);
    must(read("src/lib/build/build-pipeline.ts"), "buildSummaryFromQuality", "pipeline summary", errors);
    must(read("src/lib/build/build-pipeline.ts"), "terminalPhase", "terminal phase at end", errors);
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
