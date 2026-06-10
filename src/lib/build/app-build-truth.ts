/**
 * P1.3.23 — Single canonical build truth for workflow, preview, publish, and repair UI.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { BuildJobEventRow } from "@/lib/build/build-job-events";
import { MIN_RENDERABLE_FILES } from "@/lib/build/build-success-contract";
import {
  BUILD_NEEDS_ANOTHER_PASS,
  BUILD_PAUSED_HEADLINE,
  CONTINUE_GENERATION_LABEL,
  PREVIEW_NOT_AVAILABLE_YET,
} from "@/lib/build/build-user-copy";
import { extractWorkflowFileSignals } from "@/lib/build/build-terminal-truth";
import { loadBuildJobEvents } from "@/lib/build/build-state-truth-resolver";
import { isZipImportProject } from "@/lib/projects/imported-project-state";

type Writer = SupabaseClient<Database>;

export type AppBuildUserFacingState =
  | "generating"
  | "blocked_incomplete"
  | "files_saving"
  | "preview_preparing"
  | "preview_ready"
  | "preview_failed"
  | "failed_no_files";

export type AppBuildTruth = {
  dbAppFilesCount: number;
  workflowGeneratedFilesCount: number;
  persistedFilesCount: number;
  previewSessionId: string | null;
  previewBuildJobId: string | null;
  previewArtifactExists: boolean;
  isBlocked: boolean;
  isIncompleteNewBuild: boolean;
  isImportedApp: boolean;
  canPreview: boolean;
  canPublish: boolean;
  showRepair: boolean;
  showContinueGeneration: boolean;
  userFacingState: AppBuildUserFacingState;
  headline: string;
  bodyLine: string;
  continueGenerationPrompt: string;
};

export type AppBuildTruthFacts = {
  dbAppFilesCount: number;
  workflowEvents?: BuildJobEventRow[];
  previewSessionId?: string | null;
  previewBuildJobId?: string | null;
  previewArtifactExists?: boolean;
  previewRenderable?: boolean;
  sourceIntegrityOk?: boolean;
  previewStatus?: string | null;
  continuingGenerationNeeded?: boolean;
  failedDraft?: boolean;
  failureKind?: string | null;
  isImportedApp?: boolean;
  buildActive?: boolean;
};

function metaRecord(meta: unknown): Record<string, unknown> {
  return meta && typeof meta === "object" && !Array.isArray(meta) ? (meta as Record<string, unknown>) : {};
}

export function resolveAppBuildTruthFromFacts(input: AppBuildTruthFacts): AppBuildTruth {
  const signals = extractWorkflowFileSignals(input.workflowEvents ?? []);
  const workflowGeneratedFilesCount = Math.max(
    signals.workflowFileCount,
    signals.memoryFileCount,
  );
  const dbAppFilesCount = input.dbAppFilesCount;
  const persistedFilesCount = dbAppFilesCount;

  const continuingGenerationNeeded = input.continuingGenerationNeeded === true;
  const failedDraft = input.failedDraft === true;
  const qualityBlocked = input.failureKind === "quality_below_floor";
  const isImportedApp = input.isImportedApp === true;
  const buildActive = input.buildActive === true;

  const isIncompleteNewBuild =
    !isImportedApp &&
    (continuingGenerationNeeded || failedDraft || qualityBlocked) &&
    dbAppFilesCount < MIN_RENDERABLE_FILES;

  const isBlocked =
    isIncompleteNewBuild ||
    qualityBlocked ||
    (continuingGenerationNeeded && dbAppFilesCount < MIN_RENDERABLE_FILES);

  const previewSessionId = input.previewSessionId ?? null;
  const previewBuildJobId = input.previewBuildJobId ?? null;
  const previewArtifactExists = input.previewArtifactExists === true;
  const previewRenderable = input.previewRenderable === true;
  const sourceIntegrityOk = input.sourceIntegrityOk !== false;
  const previewActive =
    input.previewStatus === "queued" ||
    input.previewStatus === "running" ||
    input.previewStatus === "preparing";

  const hasRealFiles = dbAppFilesCount >= MIN_RENDERABLE_FILES;
  const importedPreviewArtifactReady =
    isImportedApp &&
    previewRenderable &&
    previewArtifactExists &&
    Boolean(previewBuildJobId);
  const canPreview = importedPreviewArtifactReady
    ? !isBlocked && sourceIntegrityOk
    : !isBlocked &&
      hasRealFiles &&
      sourceIntegrityOk &&
      (previewRenderable || previewArtifactExists || previewActive) &&
      Boolean(previewSessionId || previewBuildJobId || previewArtifactExists);

  const canPublish = canPreview && previewRenderable;

  const showRepair =
    isImportedApp &&
    hasRealFiles &&
    !isBlocked &&
    (input.failureKind === "preview_failed" || previewRenderable === false);

  const showContinueGeneration = isBlocked && !buildActive;

  let userFacingState: AppBuildUserFacingState;
  if (buildActive) {
    userFacingState = "generating";
  } else if (isBlocked || isIncompleteNewBuild) {
    userFacingState = "blocked_incomplete";
  } else if (!hasRealFiles) {
    userFacingState = "failed_no_files";
  } else if (previewRenderable) {
    userFacingState = "preview_ready";
  } else if (input.failureKind === "preview_failed") {
    userFacingState = "preview_failed";
  } else if (previewActive || previewArtifactExists) {
    userFacingState = "preview_preparing";
  } else if (hasRealFiles && !previewRenderable) {
    userFacingState = "preview_preparing";
  } else {
    userFacingState = "failed_no_files";
  }

  let headline: string;
  let bodyLine: string;

  if (userFacingState === "blocked_incomplete") {
    headline = BUILD_PAUSED_HEADLINE;
    bodyLine = BUILD_NEEDS_ANOTHER_PASS;
  } else if (userFacingState === "preview_ready") {
    headline = "Done — preview is ready";
    bodyLine = hasRealFiles
      ? `${dbAppFilesCount} file${dbAppFilesCount === 1 ? "" : "s"} in your project`
      : "";
  } else if (userFacingState === "failed_no_files") {
    headline = buildActive ? "Generating your app…" : BUILD_PAUSED_HEADLINE;
    bodyLine = buildActive ? "" : BUILD_NEEDS_ANOTHER_PASS;
  } else if (!canPreview && !buildActive) {
    headline = PREVIEW_NOT_AVAILABLE_YET;
    bodyLine = BUILD_NEEDS_ANOTHER_PASS;
    userFacingState = isBlocked ? "blocked_incomplete" : userFacingState;
  } else {
    headline = "Build saved — preview is being prepared";
    bodyLine = hasRealFiles
      ? `${dbAppFilesCount} file${dbAppFilesCount === 1 ? "" : "s"} saved to your project`
      : "";
  }

  if (dbAppFilesCount === 0 && !buildActive) {
    bodyLine = bodyLine.replace(/files saved.*/i, "").trim() || BUILD_NEEDS_ANOTHER_PASS;
  }

  return {
    dbAppFilesCount,
    workflowGeneratedFilesCount,
    persistedFilesCount,
    previewSessionId,
    previewBuildJobId,
    previewArtifactExists,
    isBlocked,
    isIncompleteNewBuild,
    isImportedApp,
    canPreview,
    canPublish,
    showRepair,
    showContinueGeneration,
    userFacingState,
    headline,
    bodyLine,
    continueGenerationPrompt:
      "Continue generation from the current build plan — finish missing pages, components, mock data, and navigation. Do not restart from scratch.",
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function untypedWriter(writer: Writer): any {
  return writer;
}

export async function resolveAppBuildTruth(
  writer: Writer,
  projectId: string,
  buildJobId?: string | null,
): Promise<AppBuildTruth> {
  const { count: dbAppFilesCount } = await writer
    .from("app_files")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  const { data: project } = await writer
    .from("projects")
    .select("metadata, build_status")
    .eq("id", projectId)
    .maybeSingle();

  const meta = metaRecord(project?.metadata);
  const isImportedApp = isZipImportProject(meta);

  let jobId = buildJobId ?? null;
  if (!jobId) {
    const { data: latestJob } = await writer
      .from("build_jobs")
      .select("id, status")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    jobId = latestJob?.id ?? null;
  }

  const workflowEvents = jobId ? await loadBuildJobEvents(writer, jobId) : [];

  const previewSessionId =
    typeof meta.preview_session_id === "string" ? meta.preview_session_id : null;
  const previewBuildJobId =
    typeof meta.preview_job_id === "string"
      ? meta.preview_job_id
      : typeof meta.last_preview_session_id === "string"
        ? meta.last_preview_session_id
        : null;

  const { count: previewJobs } = await untypedWriter(writer)
    .from("preview_build_jobs")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  const previewArtifactExists =
    meta.preview_renderable === true ||
    meta.preview_ready === true ||
    (previewJobs ?? 0) > 0;

  const lastMeta = workflowEvents[workflowEvents.length - 1]?.metadata ?? {};

  return resolveAppBuildTruthFromFacts({
    dbAppFilesCount: dbAppFilesCount ?? 0,
    workflowEvents,
    previewSessionId,
    previewBuildJobId,
    previewArtifactExists,
    previewRenderable: meta.preview_renderable === true,
    sourceIntegrityOk: meta.source_integrity_ok !== false,
    previewStatus:
      typeof meta.preview_status === "string"
        ? meta.preview_status
        : typeof lastMeta.preview_status === "string"
          ? lastMeta.preview_status
          : null,
    continuingGenerationNeeded:
      meta.continuing_generation_needed === true ||
      lastMeta.continuing_generation_needed === true,
    failedDraft: meta.failed_draft === true || lastMeta.failed_draft === true,
    failureKind:
      typeof lastMeta.failure_kind === "string"
        ? lastMeta.failure_kind
        : typeof meta.failure_kind === "string"
          ? meta.failure_kind
          : null,
    isImportedApp,
    buildActive: false,
  });
}

export { CONTINUE_GENERATION_LABEL };
