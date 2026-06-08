#!/usr/bin/env npx tsx
/**
 * P1.3.15 — Verify preview auto-repair prompt and eligibility.
 */
import {
  buildPreviewAutoRepairPrompt,
  previewRepairAttemptLabel,
  shouldAttemptPreviewAutoRepair,
} from "../src/lib/preview/preview-auto-repair";
import { classifyPreviewBuildFailure } from "../src/lib/preview/preview-failure-classifier";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

const classification = classifyPreviewBuildFailure({
  appFilesCount: 164,
  routesCount: 10,
  packageJsonExists: true,
  entrypointExists: true,
  previewArtifactExists: false,
  buildLogs: 'Failed to resolve import "@/components/Missing" from app/page.tsx',
  jobStatus: "failed",
  previewStatus: "failed",
});

assert(classification.auto_repair_eligible, "missing import is auto-repair eligible");
assert(shouldAttemptPreviewAutoRepair(classification, 0), "first repair attempt allowed");
assert(!shouldAttemptPreviewAutoRepair(classification, 2), "max attempts respected");

const prompt = buildPreviewAutoRepairPrompt({
  classification,
  files: [
    { path: "app/page.tsx", content: "export default function Page() {}" },
    { path: "package.json", content: "{}" },
  ],
  attempt: 0,
  userPrompt: "Build BidNest auction app",
});

assert(prompt.includes("preview_repair_attempt_1"), "repair attempt label in prompt");
assert(prompt.includes("Do NOT replace the app with a generic scaffold"), "scaffold guard in prompt");
assert(prompt.includes("Do NOT reduce app scope"), "scope guard in prompt");
assert(prompt.includes("Failed to resolve import"), "error logs in prompt");
assert(previewRepairAttemptLabel(0) === "preview_repair_attempt_1", "attempt label helper");

// Repair success path: eligibility after fix is a runtime concern; verify label for repaired state
assert(previewRepairAttemptLabel(1) === "preview_repair_attempt_2", "second attempt label");

console.log("verify:preview-auto-repair OK");
