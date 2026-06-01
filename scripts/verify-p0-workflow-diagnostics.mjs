#!/usr/bin/env node
/**
 * P0: live workflow streaming + build/preview diagnostics center.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const trace = read("src/lib/build/build-worker-trace.ts");
const live = read("src/lib/build/workflow-live-events.ts");
const coalesce = read("src/lib/build/workflow-stream-coalesce.ts");
const poll = read("src/hooks/use-build-job-progress.ts");
const stepCard = read("src/components/create/workspace/workflow-step-card.tsx");
const stream = read("src/components/create/workspace/agent-workflow-stream.tsx");
const diagUi = read("src/components/create/workspace/build-diagnostics-center.tsx");
const diagLib = read("src/lib/build/build-diagnostics.ts");
const codes = read("src/lib/preview/preview-failure-codes.ts");
const repair = read("src/lib/build/preview-deterministic-repair.ts");
const admin = read("src/lib/admin/can-view-build-diagnostics.ts");
const execute = read("src/lib/build/execute-staged-build-job.ts");
const buildStatus = read("src/app/api/projects/[id]/build-status/route.ts");

const suites = {
  "workflow-events-live": () => {
    if (trace.includes("4000")) throw new Error("4s trace throttle must be removed");
    if (!live.includes("emitWorkflowStepStarted")) throw new Error("step_started emitter missing");
    if (!live.includes("emitWorkflowStepCompleted")) throw new Error("step_completed emitter missing");
    if (!poll.includes("schedule(600)")) throw new Error("poll interval must be 600ms");
    if (!coalesce.includes("step_status")) throw new Error("coalesce must read step_status metadata");
  },
  "build-diagnostics-center": () => {
    if (!diagUi.includes("Build Diagnostics Center")) throw new Error("diagnostics UI title missing");
    if (!diagUi.includes("copy-full-fix-prompt")) throw new Error("copy prompt button missing");
    if (!diagLib.includes("buildCopyFixPrompt")) throw new Error("copy prompt builder missing");
    if (!fs.existsSync(path.join(root, "src/app/api/projects/[id]/build-jobs/[jobId]/diagnostics/route.ts"))) {
      throw new Error("diagnostics API route missing");
    }
  },
  "preview-failure-diagnostics": () => {
    if (!codes.includes("missing_root_page")) throw new Error("missing_root_page code missing");
    if (!codes.includes("compile_error")) throw new Error("compile_error code missing");
    if (!execute.includes("emitPreviewWorkflowEvent")) throw new Error("preview workflow events not wired");
    if (!execute.includes("preview_failure_code")) throw new Error("preview_failure_code metadata missing");
  },
  "admin-diagnostics-security": () => {
    if (!admin.includes("isDreamosOwnerEmail")) throw new Error("admin check must use owner emails");
    const route = read("src/app/api/projects/[id]/build-jobs/[jobId]/diagnostics/route.ts");
    if (!route.includes("canViewBuildDiagnostics")) throw new Error("API must gate diagnostics");
    if (!route.includes("403")) throw new Error("API must return 403 for non-admin");
    if (!stream.includes("isDreamosOwnerEmail")) throw new Error("client must hide diagnostics for non-admin");
  },
  "file-write-live-events": () => {
    if (!live.includes("emitFileWriteEvent")) throw new Error("file write emitter missing");
    if (!stream.includes("workflow-file-card")) throw new Error("file cards in stream");
    if (!stream.includes("ring-amber-400")) throw new Error("active file gold outline missing");
  },
  "project-lifecycle-status": () => {
    if (!buildStatus.includes("card_status")) throw new Error("card_status in build-status API");
    if (!buildStatus.includes("preview_state")) throw new Error("preview_state missing");
    if (!buildStatus.includes('cardStatus = "ready"')) throw new Error("ready gate must check integrity + root");
  },
};

const selected = process.argv.slice(2).filter(Boolean);
const run = selected.length ? selected : Object.keys(suites);

for (const name of run) {
  const fn = suites[name];
  if (!fn) {
    console.error(`Unknown suite: ${name}`);
    process.exit(1);
  }
  fn();
  console.log(`OK ${name}`);
}

console.log(`\n${run.length} suite(s) passed.`);
