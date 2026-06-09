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
  "blocked-build-no-preview": () => {
    const errors = [];
    must(read("src/lib/build/app-build-truth.ts"), "canPreview", "canPreview gate", errors);
    must(read("src/components/create/workspace/immersive-workspace.tsx"), "appBuildTruth.isBlocked", "blocked preview gate", errors);
    must(read("src/components/create/workspace/preview-panel.tsx"), "Preview not available yet", "preview unavailable copy", errors);
    mustNot(read("src/lib/build/build-final-summary.ts"), "quality is below the production floor", "no quality floor in summary", errors);
    return errors;
  },
  "no-quality-score-user-chat": () => {
    const errors = [];
    must(read("src/lib/build/build-user-copy.ts"), "sanitizeUserBuildChatText", "sanitize helper", errors);
    must(read("src/components/create/workspace/agent-workflow-stream.tsx"), "sanitizeUserBuildChatText", "sanitize in stream", errors);
    mustNot(read("src/lib/build/execute-staged-build-job.ts"), "Quality score:", "no quality score in worker chat", errors);
    return errors;
  },
  "no-repair-for-incomplete-new-build": () => {
    const errors = [];
    must(read("src/lib/build/app-build-truth.ts"), "showRepair", "showRepair flag", errors);
    must(read("src/lib/build/workflow-status-guards.ts"), "showContinueGeneration", "continue generation flag", errors);
    must(read("src/components/create/workspace/build-run-summary.tsx"), "summary-continue-generation", "continue CTA", errors);
    return errors;
  },
  "app-build-truth-resolver": () => {
    const errors = [];
    must(read("src/lib/build/app-build-truth.ts"), "resolveAppBuildTruth", "async resolver", errors);
    must(read("src/lib/build/app-build-truth.ts"), "resolveAppBuildTruthFromFacts", "pure resolver", errors);
    must(read("src/app/api/projects/[id]/build-state-truth/route.ts"), "resolveAppBuildTruth", "API wired", errors);
    return errors;
  },
  "no-preview-without-app-files": () => {
    const errors = [];
    must(read("src/lib/build/workflow-status-guards.ts"), "filesCount < MIN_RENDERABLE_FILES", "no preview without files", errors);
    must(read("src/components/create/workspace/build-run-summary.tsx"), "count >= MIN_RENDERABLE_FILES", "summary file gate", errors);
    must(read("src/components/create/workspace/agent-workflow-stream.tsx"), "failed_draft", "draft truth in stream", errors);
    return errors;
  },
  "full-app-minimum-depth": () => {
    const errors = [];
    must(read("src/lib/build/full-app-generation-plan.ts"), "minFiles: 25", "simple min files", errors);
    must(read("src/lib/build/full-app-generation-plan.ts"), "minFiles: 40", "medium min files", errors);
    must(read("src/lib/build/execute-staged-build-job.ts"), "minMeaningfulFiles", "production depth gate", errors);
    must(read("src/lib/build/chunked-generation-pipeline.ts"), "runChunkedFrontendGeneration", "chunked generation", errors);
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
