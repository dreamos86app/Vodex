/** Canonical preview metadata patches — keep panel/API fields consistent. */

export function canonicalPreviewReadyMetadata(input: {
  sessionId?: string | null;
  jobId?: string | null;
  framework?: string | null;
  artifactPath?: string | null;
}): Record<string, unknown> {
  const sessionId = input.sessionId?.trim() || input.jobId?.trim() || null;
  return {
    preview_ready: true,
    preview_honest: true,
    preview_renderable: true,
    preview_status: "ready",
    ...(sessionId
      ? {
          preview_session_id: sessionId,
          preview_job_id: input.jobId?.trim() || sessionId,
          last_preview_session_id: sessionId,
        }
      : {}),
    ...(input.framework ? { preview_framework: input.framework } : {}),
    ...(input.artifactPath ? { preview_artifact_path: input.artifactPath } : {}),
    preview_failure_kind: null,
    preview_failure_detail: null,
  };
}

export function canonicalPreviewNotStartedMetadata(input?: {
  detail?: string;
  sourceIntegrityOk?: boolean;
}): Record<string, unknown> {
  return {
    preview_ready: false,
    preview_honest: false,
    preview_renderable: false,
    preview_status: "not_started",
    preview_failure_kind: "no_preview_job",
    preview_failure_detail:
      input?.detail ??
      "No preview session was created after source files were saved.",
    ...(input?.sourceIntegrityOk === false
      ? { source_integrity_ok: false }
      : {}),
  };
}
