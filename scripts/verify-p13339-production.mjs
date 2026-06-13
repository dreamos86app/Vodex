#!/usr/bin/env node
/**
 * P1.3.39 — Production build workflow UX + model routing + stop/versions/offline.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv[2] ?? "";

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
  "model-selection-honesty": () => {
    const errors = [];
    must(read("src/lib/ai/model-selection-honesty.ts"), "validateBuildModelSelection", "validator", errors);
    must(read("src/lib/ai/model-selection-honesty.ts"), "selected_model", "log fields", errors);
    must(read("src/lib/ai/model-selection-honesty.ts"), "fallback_reason", "fallback reason", errors);
    must(read("src/lib/ai/preflight-server.ts"), "validateBuildModelSelection", "preflight gate", errors);
    must(read("src/lib/build/execute-staged-build-job.ts"), "buildModelHonestyLogFields", "build logs", errors);
    return errors;
  },
  "real-line-deltas": () => {
    const errors = [];
    must(read("src/lib/build/file-line-counts.ts"), "isGeneratedFileStub", "stub filter", errors);
    must(read("src/components/create/workspace/agent-workflow-stream.tsx"), "LiveFileLineDelta", "delta ui", errors);
    must(read("src/components/create/workspace/live-file-line-delta.tsx"), "Preparing", "preparing state", errors);
    must(read("src/components/create/workspace/live-file-line-delta.tsx"), "AnimatedLineDelta", "animated delta", errors);
    return errors;
  },
  "no-early-timeout-ui": () => {
    const errors = [];
    must(read("src/lib/build/build-step-ui.ts"), "1_200_000", "1200s threshold", errors);
    must(read("src/components/create/workspace/agent-workflow-stream.tsx"), "BUILD_USER_TIMEOUT_MS", "uses user timeout", errors);
    mustNot(
      read("src/components/create/workspace/agent-workflow-stream.tsx"),
      "showNoFilesYet && !buildElapsedStalled ? <BuildNoFilesYetCard",
      "early no-files card removed",
      errors,
    );
    return errors;
  },
  "builder-offline-resume": () => {
    const errors = [];
    must(read("src/hooks/use-builder-offline.ts"), "Connection paused", "offline copy", errors);
    must(read("src/components/create/workspace/immersive-workspace.tsx"), "useBuilderOffline", "offline hook wired", errors);
    must(read("src/hooks/use-builder-offline.ts"), "queueComposerDraft", "draft queue", errors);
    return errors;
  },
  "build-stop-keeps-files": () => {
    const errors = [];
    must(read("src/app/api/projects/[id]/build-jobs/[jobId]/cancel/route.ts"), "Prompt stopped", "stop message", errors);
    must(read("src/app/api/projects/[id]/build-jobs/[jobId]/cancel/route.ts"), "saveAppVersionSnapshot", "version on stop", errors);
    must(read("src/components/create/workspace/immersive-workspace.tsx"), "handleStopActiveJob", "stop handler", errors);
    must(read("src/components/create/workspace/immersive-workspace.tsx"), "canStopActiveJob", "stop affordance", errors);
    return errors;
  },
  "version-created-on-finish": () => {
    const errors = [];
    must(read("src/lib/projects/app-version-history.ts"), "saveAppVersionSnapshot", "version snapshot", errors);
    must(read("src/components/builder/app-version-history-panel.tsx"), "/versions", "version panel", errors);
    return errors;
  },
  "live-typing-first-response": () => {
    const errors = [];
    must(read("src/hooks/use-typed-text.ts"), "useTypedText", "typed hook", errors);
    must(read("src/components/create/workspace/agent-workflow-stream.tsx"), "TypedNarrationLine", "typed narration", errors);
    must(read("src/lib/workflow/workflow-ephemeral-steps.ts"), "Reading request", "ephemeral reading", errors);
    return errors;
  },
  "workflow-ui-production": () => {
    const errors = [];
    must(read("src/components/create/workspace/build-workflow-sections.tsx"), "BuildWorkflowSections", "sections ui", errors);
    must(read("src/components/create/workspace/build-workflow-sections.tsx"), "ephemeral-action-line", "ephemeral line", errors);
    must(read("src/components/create/workspace/agent-workflow-stream.tsx"), "workflow-interleaved-stream", "interleaved stream", errors);
    must(read("src/lib/workflow/workflow-interleaved-timeline.ts"), "buildInterleavedWorkflowItems", "interleave logic", errors);
    must(read("src/components/create/workspace/agent-workflow-stream.tsx"), "overflow-visible", "outline clip fix", errors);
    return errors;
  },
  "recipes-app-completion-gate": () => {
    const errors = [];
    must(read("src/lib/build/app-completion-gate.ts"), "evaluateRecipesAppCompletionGate", "recipes gate", errors);
    must(read("src/lib/build/app-completion-gate.ts"), "Continuing app completion", "user copy", errors);
    must(read("src/lib/build/execute-staged-build-job.ts"), "evaluateProductionCompletionGate", "gate wired", errors);
    return errors;
  },
};

if (!check) {
  console.error("Usage: node scripts/verify-p13339-production.mjs <suite>");
  process.exit(1);
}

const fn = suites[check];
if (!fn) {
  console.error(`Unknown suite: ${check}`);
  process.exit(1);
}

const errors = fn();
if (errors.length) {
  console.error(`✗ verify:${check} FAILED`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`✓ verify:${check} passed`);
