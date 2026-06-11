/**
 * P1.3.36 — Canonical preview state machine (single source of truth for PreviewPanel).
 */
import type { PreviewRuntimeStatusPayload } from "@/lib/preview/preview-runtime-status";
import type { PreviewIframeUrlResolution } from "@/lib/preview/preview-iframe-url-resolver";
import { isZipImportProject, readImportMeta } from "@/lib/projects/imported-project-state";

export type PreviewState =
  | "ready"
  | "building"
  | "queued"
  | "failed"
  | "needs_rebuild"
  | "not_started"
  | "import_ready_no_preview"
  | "ai_generation_incomplete"
  | "blocked_embed"
  | "inner_route_error"
  | "unknown";

export type PreviewClassification = "imported_zip" | "ai_generated" | "inline" | "unknown";

export type PreviewStateRawInputs = {
  projectId?: string | null;
  projectMetadata?: unknown;
  projectPreviewUrl?: string | null;
  projectFileCount?: number;
  framework?: string | null;
  runtimeStatus?: PreviewRuntimeStatusPayload | null;
  urlResolution?: PreviewIframeUrlResolution | null;
  iframeUrl?: string | null;
  iframeSrc?: string | null;
  buildActive?: boolean;
  thinking?: boolean;
  hasInline?: boolean;
  embedBlocked?: boolean;
  embedBlockReason?: string | null;
  previewUrlInvalid?: boolean;
  innerRouteError?: boolean;
  iframeError?: boolean;
  iframeLoading?: boolean;
  loadingExceeded60s?: boolean;
  iframeEmbeddable?: boolean | null;
  iframeBlockReason?: string | null;
  /** Legacy app-build-truth gate — informational only after P1.3.36 */
  legacyCanPreview?: boolean;
};

export type ResolvedPreviewState = {
  state: PreviewState;
  classification: PreviewClassification;
  title: string;
  summary: string;
  sourceOfTruth: string;
  showIframe: boolean;
  showErrorPanel: boolean;
  showBuildingShell: boolean;
  showRuntimeOverlay: boolean;
  showGenerationContinuingCopy: boolean;
  showSlowLoadHint: boolean;
  artifactId: string | null;
  workerJobId: string | null;
  workerJobStatus: string | null;
  previewRenderable: boolean;
  technical: Record<string, unknown>;
  raw: Record<string, unknown>;
};

function metaRecord(meta: unknown): Record<string, unknown> {
  return meta && typeof meta === "object" && !Array.isArray(meta) ? (meta as Record<string, unknown>) : {};
}

export function importedArtifactReady(input: {
  isImportedZip: boolean;
  runtime: PreviewRuntimeStatusPayload | null | undefined;
  meta: Record<string, unknown>;
  artifactIdFromUrl?: string | null;
}): boolean {
  if (!input.isImportedZip) return false;

  const renderable =
    input.runtime?.previewRenderable === true ||
    input.meta.preview_renderable === true ||
    input.meta.preview_ready === true;
  if (!renderable) return false;

  const hasArtifact = Boolean(
    input.runtime?.artifactPath ||
      input.runtime?.jobId ||
      input.artifactIdFromUrl ||
      (typeof input.meta.preview_artifact_path === "string" && input.meta.preview_artifact_path) ||
      (typeof input.meta.preview_job_id === "string" && input.meta.preview_job_id),
  );
  if (!hasArtifact) return false;

  const workerSucceeded =
    input.runtime?.jobStatus === "succeeded" ||
    input.meta.preview_status === "ready" ||
    (input.meta.preview_honest === true && input.meta.preview_renderable === true) ||
    (input.meta.preview_renderable === true && hasArtifact && !input.runtime);

  return workerSucceeded && hasArtifact && renderable;
}

export function isHardImportedPreviewReady(input: {
  projectMetadata?: unknown;
  runtimeStatus?: PreviewRuntimeStatusPayload | null;
  urlResolution?: PreviewIframeUrlResolution | null;
  iframeSrc?: string | null;
  iframeUrl?: string | null;
  projectPreviewUrl?: string | null;
}): boolean {
  const meta = metaRecord(input.projectMetadata);
  if (!isZipImportProject(meta)) return false;

  const hasPreviewUrl = Boolean(
    input.iframeSrc ||
      input.iframeUrl ||
      input.urlResolution?.normalizedPreviewUrl ||
      input.projectPreviewUrl,
  );
  if (!hasPreviewUrl) return false;

  const artifactId =
    input.urlResolution?.artifactId ??
    input.runtimeStatus?.jobId ??
    (typeof meta.preview_job_id === "string" ? meta.preview_job_id : null);

  return importedArtifactReady({
    isImportedZip: true,
    runtime: input.runtimeStatus,
    meta,
    artifactIdFromUrl: artifactId,
  });
}

function isJobActive(runtime: PreviewRuntimeStatusPayload | null | undefined): boolean {
  if (!runtime) return false;
  return (
    runtime.jobStatus === "running" ||
    runtime.jobStatus === "queued" ||
    runtime.previewStatus === "running" ||
    runtime.previewStatus === "queued" ||
    runtime.previewStatus === "building" ||
    runtime.previewStatus === "installing" ||
    runtime.previewStatus === "analyzing" ||
    runtime.previewStatus === "preparing"
  );
}

export function resolvePreviewState(input: PreviewStateRawInputs): ResolvedPreviewState {
  const meta = metaRecord(input.projectMetadata);
  const isImportedZip = isZipImportProject(meta);
  const importMeta = readImportMeta(meta);
  const importFileCount = importMeta.file_count ?? 0;
  const runtime = input.runtimeStatus ?? null;
  const artifactId =
    input.urlResolution?.artifactId ??
    runtime?.jobId ??
    (typeof meta.preview_job_id === "string" ? meta.preview_job_id : null);
  const workerJobId =
    runtime?.jobId ??
    (typeof meta.preview_job_id === "string" ? meta.preview_job_id : null);
  const workerJobStatus = runtime?.jobStatus ?? runtime?.previewStatus ?? null;
  const previewRenderable =
    runtime?.previewRenderable === true ||
    meta.preview_renderable === true ||
    meta.preview_ready === true;
  const hasPreviewUrl = Boolean(
    input.iframeSrc ||
      input.iframeUrl ||
      input.urlResolution?.normalizedPreviewUrl ||
      input.projectPreviewUrl,
  );
  const importedReady = importedArtifactReady({
    isImportedZip,
    runtime,
    meta,
    artifactIdFromUrl: artifactId,
  });
  const classification: PreviewClassification = input.hasInline
    ? "inline"
    : isImportedZip
      ? "imported_zip"
      : "ai_generated";

  const raw = {
    isImportedZip,
    importFileCount,
    projectFileCount: input.projectFileCount ?? 0,
    previewRenderable,
    importedArtifactReady: importedReady,
    legacyCanPreview: input.legacyCanPreview,
    runtimeJobStatus: runtime?.jobStatus ?? null,
    runtimePreviewStatus: runtime?.previewStatus ?? null,
    runtimeFailureKind: runtime?.previewFailureKind ?? null,
    urlSource: input.urlResolution?.source ?? null,
    embedBlocked: input.embedBlocked ?? false,
    previewUrlInvalid: input.previewUrlInvalid ?? false,
  };

  const technical: Record<string, unknown> = {
    projectId: input.projectId ?? null,
    artifactId,
    workerJobId,
    workerJobStatus,
    framework: input.framework ?? runtime?.framework ?? importMeta.framework?.id ?? null,
    classification,
    previewUrl: input.projectPreviewUrl ?? input.urlResolution?.normalizedPreviewUrl ?? null,
    iframeUrl: input.iframeSrc ?? input.iframeUrl ?? null,
    urlSource: input.urlResolution?.source ?? null,
    previewRenderable,
    importFileCount,
    projectFileCount: input.projectFileCount ?? 0,
    iframeEmbeddable: input.iframeEmbeddable ?? null,
    iframeBlockReason: input.iframeBlockReason ?? input.embedBlockReason ?? null,
    buildLogsTail: runtime?.buildLogs?.slice(-1200) ?? null,
    chargeStatus: runtime?.chargeStatus ?? null,
  };

  if (input.innerRouteError) {
    return {
      state: "inner_route_error",
      classification,
      title: "Imported app routed to a missing page",
      summary:
        "The preview iframe loaded, but the imported app navigated to an internal route that does not exist.",
      sourceOfTruth: "preview_inner_route_watchdog",
      showIframe: false,
      showErrorPanel: true,
      showBuildingShell: false,
      showRuntimeOverlay: false,
      showGenerationContinuingCopy: false,
      showSlowLoadHint: false,
      artifactId,
      workerJobId,
      workerJobStatus,
      previewRenderable,
      technical,
      raw,
    };
  }

  if (input.embedBlocked || input.iframeEmbeddable === false) {
    return {
      state: "blocked_embed",
      classification,
      title: "Preview embed blocked",
      summary:
        input.embedBlockReason ??
        input.iframeBlockReason ??
        "Response headers or URL policy blocked iframe embedding inside Vodex.",
      sourceOfTruth: "iframe_embeddability_probe",
      showIframe: false,
      showErrorPanel: true,
      showBuildingShell: false,
      showRuntimeOverlay: false,
      showGenerationContinuingCopy: false,
      showSlowLoadHint: false,
      artifactId,
      workerJobId,
      workerJobStatus,
      previewRenderable,
      technical,
      raw,
    };
  }

  /** P1.3.37 — Hard ready invariant: imported artifact ready overrides thinking/buildActive/isBusy. */
  const hardImportedReady = importedReady && hasPreviewUrl && !input.innerRouteError;

  if (hardImportedReady) {
    if (input.iframeError) {
      return {
        state: "needs_rebuild",
        classification,
        title: "Preview failed to boot",
        summary:
          "The preview artifact is ready but the iframe did not finish loading. Retry, clear cache, or check boot diagnostics.",
        sourceOfTruth: "imported_hard_ready_iframe_timeout",
        showIframe: false,
        showErrorPanel: true,
        showBuildingShell: false,
        showRuntimeOverlay: false,
        showGenerationContinuingCopy: false,
        showSlowLoadHint: false,
        artifactId,
        workerJobId,
        workerJobStatus: workerJobStatus ?? "succeeded",
        previewRenderable: true,
        technical,
        raw: { ...raw, hardImportedReady: true },
      };
    }

    return {
      state: "ready",
      classification,
      title: "Preview ready",
      summary: `Imported app preview is live${importFileCount ? ` (${importFileCount} files in ZIP)` : ""}.`,
      sourceOfTruth: "imported_hard_ready_invariant",
      showIframe: true,
      showErrorPanel: false,
      showBuildingShell: false,
      showRuntimeOverlay: false,
      showGenerationContinuingCopy: false,
      showSlowLoadHint: false,
      artifactId,
      workerJobId,
      workerJobStatus: workerJobStatus ?? "succeeded",
      previewRenderable: true,
      technical,
      raw: { ...raw, hardImportedReady: true },
    };
  }

  if (input.buildActive || input.thinking) {
    return {
      state: "building",
      classification,
      title: isImportedZip ? "Imported app preview is building" : "Generating your app",
      summary: isImportedZip
        ? "Vodex is compiling your imported ZIP into a preview artifact."
        : "Your app is being generated — preview opens when files are saved.",
      sourceOfTruth: "build_active",
      showIframe: false,
      showErrorPanel: false,
      showBuildingShell: true,
      showRuntimeOverlay: false,
      showGenerationContinuingCopy: false,
      showSlowLoadHint: false,
      artifactId,
      workerJobId,
      workerJobStatus,
      previewRenderable,
      technical,
      raw,
    };
  }

  if (importedReady || (previewRenderable && hasPreviewUrl)) {
    if (input.iframeError) {
      return {
        state: "needs_rebuild",
        classification,
        title: "Preview artifact is ready but the iframe did not render",
        summary:
          "The preview worker succeeded and the artifact exists, but the iframe timed out or failed to load. Retry, clear cache, or rebuild preview.",
        sourceOfTruth: importedReady ? "imported_artifact_ready_iframe_timeout" : "preview_renderable_iframe_timeout",
        showIframe: false,
        showErrorPanel: true,
        showBuildingShell: false,
        showRuntimeOverlay: false,
        showGenerationContinuingCopy: false,
        showSlowLoadHint: false,
        artifactId,
        workerJobId,
        workerJobStatus,
        previewRenderable: true,
        technical,
        raw,
      };
    }

    return {
      state: "ready",
      classification,
      title: "Preview ready",
      summary: isImportedZip
        ? `Imported app preview is live${importFileCount ? ` (${importFileCount} files in ZIP)` : ""}.`
        : "Your app preview is ready to view.",
      sourceOfTruth: importedReady ? "imported_preview_build_job" : "preview_renderable",
      showIframe: true,
      showErrorPanel: false,
      showBuildingShell: false,
      showRuntimeOverlay: false,
      showGenerationContinuingCopy: false,
      showSlowLoadHint: false,
      artifactId,
      workerJobId,
      workerJobStatus,
      previewRenderable: true,
      technical,
      raw,
    };
  }

  if (!isImportedZip && input.legacyCanPreview === false) {
    const workerNotSucceeded =
      runtime?.jobStatus != null && runtime.jobStatus !== "succeeded";
    const notRenderable = !previewRenderable;
    if (workerNotSucceeded || notRenderable) {
      return {
        state: "ai_generation_incomplete",
        classification,
        title: "Generation still in progress",
        summary:
          "Continue generation from chat when the build pauses — preview opens once enough app files are saved.",
        sourceOfTruth: "ai_build_truth_can_preview_false",
        showIframe: false,
        showErrorPanel: true,
        showBuildingShell: !hasPreviewUrl,
        showRuntimeOverlay: false,
        showGenerationContinuingCopy: true,
        showSlowLoadHint: false,
        artifactId,
        workerJobId,
        workerJobStatus,
        previewRenderable,
        technical,
        raw,
      };
    }
  }

  if (isJobActive(runtime)) {
    const queued =
      runtime?.jobStatus === "queued" || runtime?.previewStatus === "queued";
    const loadingTooLong = input.loadingExceeded60s === true;
    return {
      state: queued ? "queued" : "building",
      classification,
      title: queued ? "Preview queued" : isImportedZip ? "Imported app preview is rebuilding" : "Preview building",
      summary: loadingTooLong
        ? "Preview has been preparing for over 60 seconds. Check worker status below or run repair."
        : (runtime?.userMessage ??
          (isImportedZip
            ? "Building and validating your imported app preview…"
            : "Preview is being prepared…")),
      sourceOfTruth: "preview_build_job_active",
      showIframe: false,
      showErrorPanel: loadingTooLong,
      showBuildingShell: false,
      showRuntimeOverlay: !loadingTooLong,
      showGenerationContinuingCopy: false,
      showSlowLoadHint: false,
      artifactId,
      workerJobId,
      workerJobStatus,
      previewRenderable,
      technical,
      raw,
    };
  }

  const jobFailed =
    runtime?.jobStatus === "failed" ||
    runtime?.previewStatus === "failed" ||
    runtime?.previewFailureKind === "build_failed";
  if (jobFailed) {
    return {
      state: "failed",
      classification,
      title: "Preview build failed",
      summary:
        runtime?.userMessage ??
        runtime?.previewFailureDetail ??
        runtime?.blockedReason ??
        "The preview worker could not produce a renderable artifact.",
      sourceOfTruth: "preview_build_job_failed",
      showIframe: false,
      showErrorPanel: true,
      showBuildingShell: false,
      showRuntimeOverlay: false,
      showGenerationContinuingCopy: false,
      showSlowLoadHint: false,
      artifactId,
      workerJobId,
      workerJobStatus,
      previewRenderable,
      technical,
      raw,
    };
  }

  if (isImportedZip && importFileCount > 0 && !previewRenderable) {
    const noJob =
      runtime?.previewFailureKind === "no_preview_job" ||
      runtime?.previewStatus === "not_started" ||
      !runtime?.jobId;
    return {
      state: noJob ? "import_ready_no_preview" : "needs_rebuild",
      classification,
      title: noJob ? "Imported app ready — preview not prepared" : "Imported app preview needs rebuild",
      summary: noJob
        ? `${importFileCount} files imported. Prepare preview to build the live iframe artifact.`
        : "Preview runtime state is inconsistent — rebuild preview to restore the iframe.",
      sourceOfTruth: noJob ? "imported_zip_no_preview_job" : "imported_zip_stale_runtime",
      showIframe: false,
      showErrorPanel: true,
      showBuildingShell: false,
      showRuntimeOverlay: false,
      showGenerationContinuingCopy: false,
      showSlowLoadHint: false,
      artifactId,
      workerJobId,
      workerJobStatus,
      previewRenderable,
      technical,
      raw,
    };
  }

  if (!runtime?.jobId && !hasPreviewUrl) {
    return {
      state: "not_started",
      classification,
      title: "Preview not started",
      summary: isImportedZip
        ? "Import files are saved. Prepare preview to enable the live iframe."
        : "Generate or import app files to enable preview.",
      sourceOfTruth: "no_preview_job_or_url",
      showIframe: false,
      showErrorPanel: true,
      showBuildingShell: false,
      showRuntimeOverlay: false,
      showGenerationContinuingCopy: false,
      showSlowLoadHint: false,
      artifactId,
      workerJobId,
      workerJobStatus,
      previewRenderable,
      technical,
      raw,
    };
  }

  if (input.previewUrlInvalid) {
    return {
      state: "needs_rebuild",
      classification,
      title: "Preview URL invalid",
      summary: "The preview iframe URL could not be resolved. Clear cache and rebuild preview.",
      sourceOfTruth: "preview_url_invalid",
      showIframe: false,
      showErrorPanel: true,
      showBuildingShell: false,
      showRuntimeOverlay: false,
      showGenerationContinuingCopy: false,
      showSlowLoadHint: false,
      artifactId,
      workerJobId,
      workerJobStatus,
      previewRenderable,
      technical,
      raw,
    };
  }

  return {
    state: "unknown",
    classification,
    title: "Preview state unclear",
    summary:
      "Preview runtime state is inconsistent. Run repair preview state or rebuild preview.",
    sourceOfTruth: "fallback_unknown",
    showIframe: false,
    showErrorPanel: true,
    showBuildingShell: false,
    showRuntimeOverlay: Boolean(runtime && !previewRenderable),
    showGenerationContinuingCopy: false,
    showSlowLoadHint: false,
    artifactId,
    workerJobId,
    workerJobStatus,
    previewRenderable,
    technical,
    raw,
  };
}
