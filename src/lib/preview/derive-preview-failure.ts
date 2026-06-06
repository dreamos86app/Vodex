import type { PreviewRuntimeStatusPayload } from "@/lib/preview/preview-runtime-status";

export type PreviewFailureKind =
  | "no_preview_job"
  | "no_artifact"
  | "worker_unavailable"
  | "unsupported_framework"
  | "build_failed"
  | "artifact_upload_failed"
  | "route_manifest_empty"
  | "runtime_error"
  | "iframe_blocked"
  | "unknown";

export function derivePreviewFailure(
  status: Pick<
    PreviewRuntimeStatusPayload,
    | "previewRenderable"
    | "previewStatus"
    | "jobStatus"
    | "jobId"
    | "artifactPath"
    | "blockedReason"
    | "errorCode"
    | "workerUnavailable"
    | "userMessage"
    | "previewSource"
  >,
  meta: Record<string, unknown>,
): { kind: PreviewFailureKind | null; detail: string | null } {
  if (status.previewRenderable) return { kind: null, detail: null };

  const explicit =
    typeof meta.preview_failure_kind === "string" ? meta.preview_failure_kind : null;
  const explicitDetail =
    typeof meta.preview_failure_detail === "string" ? meta.preview_failure_detail : null;
  if (explicit) return { kind: explicit as PreviewFailureKind, detail: explicitDetail };

  if (status.workerUnavailable) {
    return {
      kind: "worker_unavailable",
      detail:
        status.userMessage ??
        "Preview worker is not connected. Deploy or start the preview worker.",
    };
  }

  if (status.jobStatus === "failed" || status.previewStatus === "failed") {
    return {
      kind: "build_failed",
      detail: status.userMessage ?? status.blockedReason ?? status.errorCode ?? "Preview build failed.",
    };
  }

  const previewNotStarted =
    status.previewStatus === "not_started" || meta.preview_status === "not_started";
  const hasLiveJobOrSession =
    status.previewSource === "worker_job" || status.previewSource === "preview_session";

  if (
    (!hasLiveJobOrSession && status.previewSource === "none") ||
    (previewNotStarted && !hasLiveJobOrSession)
  ) {
    if (meta.source_integrity_ok === false) {
      return {
        kind: "runtime_error",
        detail:
          typeof meta.blocked_reason === "string"
            ? meta.blocked_reason
            : "Source integrity check failed before preview could start.",
      };
    }
    return {
      kind: "no_preview_job",
      detail:
        typeof meta.preview_failure_detail === "string"
          ? meta.preview_failure_detail
          : "No preview session was created after source files were saved.",
    };
  }

  if (
    !hasLiveJobOrSession &&
    status.previewSource === "metadata" &&
    !status.previewRenderable
  ) {
    const staleRef =
      typeof meta.preview_job_id === "string" ||
      typeof meta.preview_session_id === "string" ||
      typeof meta.last_preview_session_id === "string";
    return {
      kind: "no_preview_job",
      detail: staleRef
        ? "Preview session reference is stale — start preview again."
        : "No preview job or session is linked to this project yet.",
    };
  }

  if (status.previewSource === "preview_session" && status.previewStatus === "ready" && !status.artifactPath) {
    return {
      kind: null,
      detail: null,
    };
  }

  if (
    (status.jobStatus === "succeeded" || status.previewStatus === "ready") &&
    !status.artifactPath &&
    status.previewSource === "worker_job"
  ) {
    return {
      kind: "no_artifact",
      detail: "Preview build finished but no artifact path was stored.",
    };
  }

  if (status.blockedReason?.toLowerCase().includes("unsupported")) {
    return { kind: "unsupported_framework", detail: status.blockedReason };
  }

  if (status.errorCode === "iframe_blocked") {
    return { kind: "iframe_blocked", detail: status.userMessage ?? status.blockedReason };
  }

  if (status.previewStatus === "queued" || status.jobStatus === "queued") {
    return { kind: null, detail: "Preview is queued." };
  }

  if (status.previewStatus === "running" || status.jobStatus === "running") {
    return { kind: null, detail: "Preview build is running." };
  }

  return {
    kind: "unknown",
    detail:
      status.userMessage ??
      status.blockedReason ??
      "Preview is not ready — waiting for a renderable build.",
  };
}
