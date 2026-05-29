#!/usr/bin/env node
/**
 * Agent workflow UI + status guard verification (P0 workflow upgrade).
 * Run: node scripts/verify-workflow-agent-ui.mjs [suite...]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const guards = read("src/lib/build/workflow-status-guards.ts");
const coalesce = read("src/lib/build/workflow-stream-coalesce.ts");
const types = read("src/lib/build/workflow-stream-types.ts");
const streamUi = read("src/components/create/workspace/agent-workflow-stream.tsx");
const summary = read("src/components/create/workspace/build-run-summary.tsx");
const jobEvents = read("src/lib/build/build-job-events.ts");
const execute = read("src/lib/build/execute-staged-build-job.ts");
const contract = read("src/lib/build/post-build-contract.ts");
const immersive = read("src/components/create/workspace/immersive-workspace.tsx");
const pipeline = read("src/lib/build/build-pipeline.ts");
const lineCounts = read("src/lib/build/file-line-counts.ts");
const creationWs = read("src/components/create/workspace/creation-workspace.tsx");
const createPage = read("src/components/create/create-page-body.tsx");
const composerText = read("src/lib/create/composer-text.ts");
const builderGate = read("src/components/create/builder-project-gate.tsx");

const suites = {
  "workflow-event-schema": () => {
    if (!types.includes("assistant_message")) throw new Error("missing assistant_message category");
    if (!types.includes("file_created")) throw new Error("missing file_created category");
    if (!types.includes("failed_before_generation")) throw new Error("missing failed_before_generation");
  },
  "workflow-no-duplicate-repeated-steps": () => {
    if (!coalesce.includes("stableKey")) throw new Error("coalesce must use stableKey");
    if (!coalesce.includes("GENERIC_TITLES")) throw new Error("coalesce must filter generic titles");
    if (jobEvents.includes("Planning data model")) throw new Error("duplicate initial planning event still seeded");
  },
  "workflow-file-change-cards": () => {
    if (!streamUi.includes("workflow-file-card")) throw new Error("file change cards missing");
    if (!streamUi.includes("FileChangeCard")) throw new Error("FileChangeCard component missing");
  },
  "workflow-line-counts": () => {
    if (!coalesce.includes("addedLines")) throw new Error("line count parsing missing in coalesce");
    if (!streamUi.includes("+${event.addedLines}")) throw new Error("UI must show +line counts");
  },
  "workflow-natural-assistant-messages": () => {
    if (!jobEvents.includes("stream_category")) throw new Error("assistant stream_category metadata missing");
    if (!jobEvents.includes("I'll build this based on your request")) throw new Error("natural opener missing");
  },
  "composer-enablement-credits-gate": () => {
    if (!composerText.includes("creditsConfirmed")) {
      throw new Error("composer must gate credits on creditsConfirmed");
    }
    if (!createPage.includes("opacity-0")) {
      throw new Error("create workspace layer must not use display:hidden during hydrate");
    }
    if (read("src/components/create/create-server-composer-island.tsx").includes('data-testid="create-composer-ready"')) {
      throw new Error("server island must not emit fake create-composer-ready");
    }
  },
  "workflow-assistant-messages-during-build": () => {
    if (!pipeline.includes("trackAssistant")) throw new Error("trackAssistant missing in pipeline");
    if (!pipeline.includes("I understand what you're building")) throw new Error("mid-build assistant missing");
    if (!jobEvents.includes("persistAssistantBuildMessage")) throw new Error("persistAssistantBuildMessage missing");
    if (!execute.includes("persistAssistantBuildMessage")) throw new Error("terminal assistant summary missing");
  },
  "workflow-line-counts-from-backend": () => {
    if (!lineCounts.includes("computeFileLineMeta")) throw new Error("computeFileLineMeta missing");
    if (!pipeline.includes("mergeIncomingBuildFiles")) throw new Error("mergeIncomingBuildFiles missing");
    if (!jobEvents.includes("added_lines")) throw new Error("persist must include added_lines metadata");
    if (!jobEvents.includes("old_line_count")) throw new Error("persist must include old_line_count metadata");
  },
  "no-legacy-build-timeline-visible": () => {
    if (creationWs.includes("BuildTimeline") || creationWs.includes("BuildStatusNarrator")) {
      throw new Error("creation-workspace still mounts legacy timeline/narrator");
    }
    if (!immersive.includes("BuildLiveProgress") && !immersive.includes("AgentWorkflowStream")) {
      throw new Error("immersive must use agent workflow stream");
    }
    if (!createPage.includes("CreateWorkspaceEntry")) {
      throw new Error("create page must use CreateWorkspaceEntry (ImmersiveWorkspace)");
    }
    if (!builderGate.includes("ImmersiveWorkspace")) {
      throw new Error("builder gate must use ImmersiveWorkspace");
    }
  },
  "workflow-status-state-guards": () => {
    if (!guards.includes("deriveBuildStatusFacts")) throw new Error("deriveBuildStatusFacts missing");
    if (!guards.includes("resolveBuildRunSummary")) throw new Error("resolveBuildRunSummary missing");
    if (!immersive.includes("applyTerminalBuildSummary")) throw new Error("immersive must use guarded summary");
  },
  "no-repair-copy-before-files": () => {
    if (!guards.includes("failed_before_generation")) throw new Error("failed_before_generation status missing");
    if (!execute.includes("failure_kind")) throw new Error("failure_kind metadata not persisted");
    if (contract.includes("another repair pass before preview") && !contract.includes("!hasRenderableFiles"))
      throw new Error("contract must guard repair copy when no files");
  },
  "no-refund-copy-without-refund": () => {
    if (!guards.includes("creditsRefunded")) throw new Error("creditsRefunded fact missing");
    if (!guards.includes("assertRefundCopyAllowed")) throw new Error("refund guard missing");
    if (immersive.includes("refunded: failed && !partial"))
      throw new Error("immersive must not use heuristic refunded=failed&&!partial");
  },
  "partial-build-copy-correct": () => {
    if (!guards.includes("partial_credit_stop")) throw new Error("partial_credit_stop copy missing");
    if (!summary.includes("Partial progress saved")) throw new Error("summary partial headline missing");
  },
  "failed-before-generation-copy": () => {
    if (!guards.includes("Couldn't start the build")) throw new Error("failed before generation headline missing");
    if (!execute.includes("userSafeFailureTitle")) throw new Error("execute must use safe failure titles");
  },
  "failed-after-generation-copy": () => {
    if (!guards.includes("failed_after_generation")) throw new Error("failed_after_generation missing");
  },
  "build-summary-card": () => {
    if (!summary.includes("data-testid=\"build-run-summary\"")) throw new Error("summary card testid missing");
    if (!summary.includes("showRepairActions")) throw new Error("repair actions prop missing");
  },
  "workflow-reduced-motion": () => {
    if (!streamUi.includes("useReducedMotion")) throw new Error("reduced motion hook missing");
  },
};

const requested = process.argv.slice(2).filter(Boolean);
const keys = requested.length ? requested : Object.keys(suites);
const errors = [];
const ok = [];

for (const key of keys) {
  const fn = suites[key];
  if (!fn) {
    errors.push(`unknown suite: ${key}`);
    continue;
  }
  try {
    fn();
    ok.push(key);
  } catch (e) {
    errors.push(`${key}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

console.log("\n=== verify:workflow-agent-ui ===\n");
ok.forEach((m) => console.log("✓", m));
errors.forEach((m) => console.error("✗", m));
process.exit(errors.length ? 1 : 0);
