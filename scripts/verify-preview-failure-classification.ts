#!/usr/bin/env npx tsx
/**
 * P1.3.15 — Fixture tests for preview failure classification.
 */
import { classifyPreviewBuildFailure } from "../src/lib/preview/preview-failure-classifier";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

const failedJob = {
  routesCount: 12,
  entrypointExists: true,
  previewArtifactExists: false,
  jobStatus: "failed" as const,
  previewStatus: "failed" as const,
};

// 1. 164 files + missing import → missing_import
const missingImport = classifyPreviewBuildFailure({
  ...failedJob,
  appFilesCount: 164,
  packageJsonExists: true,
  buildLogs: `error during build:
Failed to resolve import "@/components/BidCard" from "app/page.tsx"`,
});
assert(
  missingImport.failure_kind === "missing_import",
  `fixture 1: expected missing_import, got ${missingImport.failure_kind}`,
);

// 2. 164 files + TypeScript error → typescript_compile_failed
const tsError = classifyPreviewBuildFailure({
  ...failedJob,
  appFilesCount: 164,
  packageJsonExists: true,
  buildLogs: "app/dashboard/page.tsx:42:5 - error TS2322: Type 'string' is not assignable to type 'number'.",
});
assert(
  tsError.failure_kind === "typescript_compile_failed",
  `fixture 2: expected typescript_compile_failed, got ${tsError.failure_kind}`,
);

// 3. package.json missing → true_incomplete_files
const noPkg = classifyPreviewBuildFailure({
  ...failedJob,
  appFilesCount: 3,
  packageJsonExists: false,
  routesCount: 0,
  entrypointExists: false,
  sourceIntegrityOk: false,
});
assert(
  noPkg.failure_kind === "true_incomplete_files",
  `fixture 3: expected true_incomplete_files, got ${noPkg.failure_kind}`,
);

// 4. Vite config error → vite_build_failed
const viteFail = classifyPreviewBuildFailure({
  ...failedJob,
  appFilesCount: 164,
  packageJsonExists: true,
  buildLogs: "[vite] vite build failed\nRollup failed to resolve import",
  blockedReason: "vite build failed",
});
assert(
  viteFail.failure_kind === "vite_build_failed" || viteFail.failure_kind === "missing_import",
  `fixture 4: expected vite_build_failed or missing_import, got ${viteFail.failure_kind}`,
);

// Substantial app must NOT be true_incomplete_files when preview job failed
const substantialMisclass = classifyPreviewBuildFailure({
  ...failedJob,
  appFilesCount: 164,
  packageJsonExists: true,
  sourceIntegrityOk: false,
  meaningfulSourceFileCount: 40,
  buildLogs: "npm ERR! code ELIFECYCLE",
});
assert(
  substantialMisclass.failure_kind !== "true_incomplete_files",
  `fixture 5: 164-file app must not be true_incomplete_files`,
);

console.log("verify:preview-failure-classification OK");
