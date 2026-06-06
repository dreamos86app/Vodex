import assert from "node:assert/strict";
import { derivePreviewFailure } from "../src/lib/preview/derive-preview-failure";
import type { PreviewRuntimeStatusPayload } from "../src/lib/preview/preview-runtime-status";

function baseStatus(
  patch: Partial<PreviewRuntimeStatusPayload>,
): PreviewRuntimeStatusPayload {
  return {
    previewRenderable: false,
    previewHonest: false,
    previewStatus: "not_started",
    jobStatus: null,
    jobId: null,
    framework: null,
    frameworkLabel: null,
    artifactPath: null,
    blockedReason: null,
    errorCode: null,
    userMessage: null,
    buildLogs: null,
    lockedBy: null,
    workerUnavailable: false,
    workerConnected: false,
    workerUnavailableMessage: null,
    jobCreatedAt: null,
    jobAgeLabel: null,
    jobAgeSeconds: null,
    requiresDeployedWorker: false,
    lastPreviewBuildAt: null,
    entryFile: null,
    warnings: [],
    previewBuildMeta: null,
    packageRepairDiagnostics: null,
    estimatedActionCredits: null,
    chargedActionCredits: null,
    creditsCharged: false,
    chargeStatus: null,
    previewFailureKind: null,
    previewFailureDetail: null,
    previewSource: "none",
    ...patch,
  };
}

// Generated app with session ready
{
  const status = baseStatus({
    previewRenderable: true,
    previewHonest: true,
    previewStatus: "ready",
    jobId: "session-abc",
    jobStatus: "succeeded",
    previewSource: "preview_session",
    artifactPath: "session:snap-1",
  });
  const failure = derivePreviewFailure(status, {
    preview_session_id: "session-abc",
    preview_renderable: true,
    preview_honest: true,
    preview_status: "ready",
  });
  assert.equal(failure.kind, null);
}

// Source files saved but no preview session
{
  const status = baseStatus({ previewStatus: "not_started", previewSource: "none" });
  const failure = derivePreviewFailure(status, {
    preview_status: "not_started",
    preview_failure_kind: "no_preview_job",
    source_integrity_ok: true,
  });
  assert.equal(failure.kind, "no_preview_job");
}

console.log("test-preview-runtime-status-fixtures: OK");
