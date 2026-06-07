#!/usr/bin/env npx tsx
/**
 * P1.3.13 — Verify persisted build state truth (fixture + wiring).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePersistedBuildStatus } from "../src/lib/build/build-state-truth-resolver";
import type { BuildJobEventRow } from "../src/lib/build/build-job-events";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exitCode = 1;
    return false;
  }
  console.log("OK:", msg);
  return true;
}

const fixtureEvents = [
  {
    id: "1",
    job_id: "job-fixture",
    project_id: "proj-fixture",
    user_id: "user-fixture",
    type: "failed" as const,
    title: "Couldn't start the build",
    detail: "12 files in memory",
    file_path: null,
    progress_percent: 100,
    metadata: { failure_kind: "failed_before_generation", file_count: 0 },
    created_at: new Date().toISOString(),
  },
  {
    id: "2",
    job_id: "job-fixture",
    project_id: "proj-fixture",
    user_id: "user-fixture",
    type: "writing_file" as const,
    title: "Created app/page.tsx",
    detail: "app/page.tsx",
    file_path: "app/page.tsx",
    progress_percent: 50,
    metadata: {},
    created_at: new Date().toISOString(),
  },
];

const resolved = resolvePersistedBuildStatus({
  appFilesCount: 12,
  previewSessionsCount: 0,
  workflowEvents: fixtureEvents as BuildJobEventRow[],
  failureKind: "failed_before_generation",
  failureMessage: "persisted_components_3_lt_5",
  wasPersistenceAttempted: true,
  wasPreviewStartAttempted: false,
});

assert(resolved.buildStatus === "files_saved_preview_pending", "status repaired to files_saved_preview_pending");
assert(resolved.failureKind !== "failed_before_generation", "failure_kind not failed_before_generation when app_files >= 4");
assert(
  !/couldn'?t start the build/i.test(resolved.headline),
  "UI headline not catastrophic",
);
assert(resolved.jobStatus === "completed", "job status completed for preview pending with files");

// Wiring checks
assert(read("src/lib/build/finalize-build.ts").includes("resolvePersistedBuildStatus"), "finalize uses resolver");
assert(read("src/lib/build/build-state-truth-resolver.ts").includes("resolvePersistedBuildStatus"), "resolver module exists");
assert(read("src/lib/build/build-state-truth-repair.ts").includes("repairBuildStateTruth"), "repair module exists");
assert(
  read("src/lib/build/reconcile-project-build-server.ts").includes("repairBuildStateTruth"),
  "server reconcile uses repair",
);
assert(
  read("src/app/api/projects/[id]/build-state-truth/route.ts").includes("repairBuildStateTruth"),
  "build-state-truth API exists",
);
assert(read("package.json").includes("repair:build-state-truth"), "repair npm script");
assert(read("package.json").includes("verify:real-build-failure-state"), "verify npm script");

const artifact = {
  generated_at: new Date().toISOString(),
  fixture: {
    failure_kind: "failed_before_generation",
    memory_phrase: "12 files in memory",
    app_files_count: 12,
    preview_sessions_count: 0,
  },
  expected: {
    build_status: "files_saved_preview_pending",
    headline_not: "Couldn't start the build",
  },
  actual: {
    build_status: resolved.buildStatus,
    headline: resolved.headline,
    failure_kind: resolved.failureKind,
    job_status: resolved.jobStatus,
  },
};

const outDir = path.join(root, "artifacts", "benchmarks", "p1313");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "verify-real-build-failure-state.json"), JSON.stringify(artifact, null, 2));

if (!process.exitCode) {
  console.log("\nverify:real-build-failure-state passed");
}
