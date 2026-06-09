import type { PreviewRuntimeStatusPayload } from "@/lib/preview/preview-runtime-status";
import type { PreviewFailureKind } from "@/lib/preview/derive-preview-failure";

/** User-facing preview classification — never default to scary blocked without proof. */
export type ImportedPreviewState =
  | "preview_ready"
  | "preview_loading"
  | "preview_repair_needed"
  | "preview_blocked_iframe"
  | "preview_artifact_missing"
  | "preview_not_started"
  | "preview_runtime_failed";

export type ImportedPreviewStateResult = {
  state: ImportedPreviewState;
  title: string;
  summary: string;
  showScaryBlocked: boolean;
  showPrepareButton: boolean;
  showOpenNewTab: boolean;
  showEmbedRepair: boolean;
  showRepairCta: boolean;
  failureKind: PreviewFailureKind | null;
};

export function classifyImportedPreviewState(
  runtime: PreviewRuntimeStatusPayload | null | undefined,
  opts?: {
    isImported?: boolean;
    hasFiles?: boolean;
    iframeEmbedFailed?: boolean;
  },
): ImportedPreviewStateResult {
  const hasFiles = opts?.hasFiles !== false;
  const isImported = opts?.isImported === true;

  if (!runtime && !hasFiles) {
    return {
      state: "preview_not_started",
      title: "Preview not started",
      summary: "Add or import source files to prepare a preview.",
      showScaryBlocked: false,
      showPrepareButton: false,
      showOpenNewTab: false,
      showEmbedRepair: false,
      showRepairCta: false,
      failureKind: "no_preview_job",
    };
  }

  const buildFailed =
    runtime?.jobStatus === "failed" ||
    runtime?.previewStatus === "failed" ||
    runtime?.previewFailureKind === "build_failed" ||
    runtime?.previewFailureKind === "runtime_error" ||
    runtime?.previewFailureKind === "unsupported_framework";

  if (buildFailed) {
    return {
      state: "preview_runtime_failed",
      title: "Preview build failed",
      summary:
        runtime?.userMessage ??
        runtime?.previewFailureDetail ??
        runtime?.blockedReason ??
        "Check build logs and run auto-repair to fix the issue.",
      showScaryBlocked: false,
      showPrepareButton: true,
      showOpenNewTab: false,
      showEmbedRepair: false,
      showRepairCta: true,
      failureKind: (runtime?.previewFailureKind as PreviewFailureKind) ?? "build_failed",
    };
  }

  if (runtime?.previewRenderable) {
    return {
      state: "preview_ready",
      title: "Preview ready",
      summary: "Your app preview is ready to view.",
      showScaryBlocked: false,
      showPrepareButton: false,
      showOpenNewTab: true,
      showEmbedRepair: false,
      showRepairCta: false,
      failureKind: null,
    };
  }

  const loading =
    runtime?.jobStatus === "running" ||
    runtime?.previewStatus === "running" ||
    runtime?.jobStatus === "queued" ||
    runtime?.previewStatus === "queued" ||
    runtime?.previewStatus === "building" ||
    runtime?.previewStatus === "installing" ||
    runtime?.previewStatus === "analyzing";

  if (loading) {
    return {
      state: "preview_loading",
      title: "Preparing preview",
      summary: runtime?.userMessage ?? "Building and validating your imported app preview…",
      showScaryBlocked: false,
      showPrepareButton: false,
      showOpenNewTab: false,
      showEmbedRepair: false,
      showRepairCta: false,
      failureKind: null,
    };
  }

  const kind = (runtime?.previewFailureKind ?? null) as PreviewFailureKind | null;

  if (opts?.iframeEmbedFailed || kind === "iframe_blocked") {
    return {
      state: "preview_blocked_iframe",
      title: "Preview embed blocked",
      summary: "This site refused to load inside the builder frame. Open it in a new tab or run embed repair.",
      showScaryBlocked: false,
      showPrepareButton: false,
      showOpenNewTab: true,
      showEmbedRepair: true,
      showRepairCta: true,
      failureKind: "iframe_blocked",
    };
  }

  if (
    kind === "no_preview_job" ||
    runtime?.previewStatus === "not_started" ||
    (!runtime?.artifactPath && hasFiles && isImported)
  ) {
    return {
      state: "preview_not_started",
      title: "Preview needs to be prepared",
      summary:
        "Your imported files are saved. Prepare preview to scan routes, build an artifact, and enable the live preview.",
      showScaryBlocked: false,
      showPrepareButton: true,
      showOpenNewTab: false,
      showEmbedRepair: false,
      showRepairCta: false,
      failureKind: kind ?? "no_preview_job",
    };
  }

  if (kind === "no_artifact" || kind === "artifact_upload_failed") {
    return {
      state: "preview_artifact_missing",
      title: "Preview artifact missing",
      summary: runtime?.previewFailureDetail ?? "The preview build finished without a renderable artifact.",
      showScaryBlocked: false,
      showPrepareButton: true,
      showOpenNewTab: false,
      showEmbedRepair: false,
      showRepairCta: true,
      failureKind: kind,
    };
  }

  if (
    kind === "build_failed" ||
    kind === "runtime_error" ||
    kind === "unsupported_framework" ||
    runtime?.previewStatus === "failed" ||
    runtime?.jobStatus === "failed"
  ) {
    return {
      state: "preview_runtime_failed",
      title: "Preview build failed",
      summary:
        runtime?.userMessage ??
        runtime?.previewFailureDetail ??
        runtime?.blockedReason ??
        "Check build logs and run repair to fix the issue.",
      showScaryBlocked: false,
      showPrepareButton: true,
      showOpenNewTab: false,
      showEmbedRepair: false,
      showRepairCta: true,
      failureKind: kind ?? "build_failed",
    };
  }

  if (kind === "worker_unavailable") {
    return {
      state: "preview_repair_needed",
      title: "Preview worker unavailable",
      summary:
        runtime?.workerUnavailableMessage ??
        runtime?.userMessage ??
        "Connect the preview worker or prepare preview when the worker is available.",
      showScaryBlocked: false,
      showPrepareButton: true,
      showOpenNewTab: false,
      showEmbedRepair: false,
      showRepairCta: true,
      failureKind: kind,
    };
  }

  if (hasFiles && isImported) {
    return {
      state: "preview_repair_needed",
      title: "Preview needs attention",
      summary:
        runtime?.previewFailureDetail ??
        runtime?.userMessage ??
        "Run prepare preview or repair to restore a renderable preview.",
      showScaryBlocked: false,
      showPrepareButton: true,
      showOpenNewTab: false,
      showEmbedRepair: false,
      showRepairCta: true,
      failureKind: kind,
    };
  }

  return {
    state: "preview_not_started",
    title: "Preview not ready",
    summary: "Prepare preview when your source files are saved.",
    showScaryBlocked: false,
    showPrepareButton: hasFiles,
    showOpenNewTab: false,
    showEmbedRepair: false,
    showRepairCta: false,
    failureKind: kind,
  };
}
