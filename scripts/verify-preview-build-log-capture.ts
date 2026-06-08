#!/usr/bin/env npx tsx
/**
 * P1.3.15 — Verify build log normalization and tail capture.
 */
import { normalizePreviewBuildLogs } from "../src/lib/preview/preview-build-log-normalizer";
import { buildLatestPreviewFailureRecord } from "../src/lib/preview/persist-preview-failure-metadata";
import { classifyPreviewBuildFailure } from "../src/lib/preview/preview-failure-classifier";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
}

const sampleLog =
  Array.from({ length: 250 }, (_, i) => `line ${i + 1}`).join("\n") +
  '\nFailed to resolve import "@/lib/missing" from app/page.tsx\nTS2307: Cannot find module \'@/lib/missing\'';

const normalized = normalizePreviewBuildLogs(sampleLog);

assert(normalized.build_logs_tail.length <= 200, "log tail capped at 200 lines");
assert(normalized.build_logs_tail.length > 0, "log tail non-empty");
assert(normalized.missing_imports.includes("@/lib/missing"), "missing import parsed");

const tsOnlyLog =
  "app/dashboard/page.tsx:42:5 - error TS2322: Type 'string' is not assignable to type 'number'.";
const classification = classifyPreviewBuildFailure({
  appFilesCount: 164,
  routesCount: 8,
  packageJsonExists: true,
  entrypointExists: true,
  previewArtifactExists: false,
  buildLogs: tsOnlyLog,
  jobStatus: "failed",
  previewStatus: "failed",
});

const record = buildLatestPreviewFailureRecord({
  classification,
  appFilesCount: 164,
  routesCount: 8,
  packageJsonExists: true,
  entrypointExists: true,
  previewArtifactExists: false,
});

assert(record.build_logs_tail.length > 0, "failure record includes log tail");
assert(classification.typescript_error != null, "TS error extracted from logs");
assert(classification.failure_kind === "typescript_compile_failed", "TS error classified");

console.log("verify:preview-build-log-capture OK");
