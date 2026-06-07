/**
 * P1.3.13 — Pure persisted build state resolution + inspect (no server-only preview deps).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { BuildJobEventRow } from "@/lib/build/build-job-events";
import { MIN_RENDERABLE_FILES } from "@/lib/build/build-success-contract";
import {
  extractWorkflowFileSignals,
  hasRecoverableBuildFiles,
  resolveBuildTerminalTruth,
  truthFailureKindForPersist,
  type BuildTerminalTruth,
} from "@/lib/build/build-terminal-truth";

type Writer = SupabaseClient<Database>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function untypedWriter(writer: Writer): any {
  return writer;
}

async function countPreviewSessions(writer: Writer, projectId: string): Promise<number> {
  const { count } = await untypedWriter(writer)
    .from("preview_sessions")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);
  return count ?? 0;
}

async function countPreviewBuildJobs(writer: Writer, projectId: string): Promise<number> {
  const { count } = await untypedWriter(writer)
    .from("preview_build_jobs")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);
  return count ?? 0;
}

export async function loadBuildJobEvents(writer: Writer, jobId: string): Promise<BuildJobEventRow[]> {
  const { data: rows } = await writer
    .from("build_job_events")
    .select("id, job_id, project_id, user_id, type, title, detail, file_path, progress_percent, metadata, created_at")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });
  return (rows ?? []) as BuildJobEventRow[];
}

export type BuildStateDebugObject = {
  project_id: string;
  build_job_id: string | null;
  build_status: string | null;
  file_count_metadata: number;
  app_files_count: number;
  preview_sessions_count: number;
  preview_build_jobs_count: number;
  final_workflow_event: {
    type: string | null;
    title: string | null;
    failure_kind: string | null;
    file_count: number | null;
  };
  failure_kind: string | null;
  failure_stage: string | null;
  failure_message: string | null;
  was_persistence_attempted: boolean;
  was_preview_start_attempted: boolean;
  why_ui_shows_failed: string;
  canonical_state: string;
  terminal_truth_state: string;
};

export type ResolvedPersistedBuildState = {
  buildStatus: string;
  jobStatus: "failed" | "completed";
  failureKind: string | null;
  failureStage: string | null;
  headline: string;
  bodyLines: string[];
  terminalTruth: BuildTerminalTruth;
  metadataPatch: Record<string, unknown>;
  shouldClearCatastrophicFailure: boolean;
};

function metaRecord(meta: unknown): Record<string, unknown> {
  return meta && typeof meta === "object" && !Array.isArray(meta) ? (meta as Record<string, unknown>) : {};
}

function failureStageFromSignals(input: {
  appFilesCount: number;
  wasPersistenceAttempted: boolean;
  wasPreviewStartAttempted: boolean;
  previewFailed: boolean;
  failureKind: string | null;
}): string | null {
  if (input.appFilesCount >= MIN_RENDERABLE_FILES && input.previewFailed) return "preview";
  if (input.appFilesCount >= MIN_RENDERABLE_FILES && !input.wasPreviewStartAttempted) return "preview_pending";
  if (input.appFilesCount >= MIN_RENDERABLE_FILES && input.wasPersistenceAttempted) return "persist_ok";
  if (input.appFilesCount > 0 && input.appFilesCount < MIN_RENDERABLE_FILES) return "persist_partial";
  if (input.failureKind === "failed_before_generation") return "pre_generation";
  if (input.wasPersistenceAttempted && input.appFilesCount === 0) return "persist_failed";
  return input.failureKind ? "terminal" : null;
}

export function resolvePersistedBuildStatus(input: {
  appFilesCount: number;
  previewSessionsCount: number;
  workflowEvents: BuildJobEventRow[];
  failureKind?: string | null;
  failureMessage?: string | null;
  previewRenderable?: boolean;
  previewFailed?: boolean;
  wasPersistenceAttempted?: boolean;
  wasPreviewStartAttempted?: boolean;
}): ResolvedPersistedBuildState {
  const signals = extractWorkflowFileSignals(input.workflowEvents);
  const memoryFileCount = signals.memoryFileCount;
  const previewNotStarted =
    input.previewSessionsCount === 0 &&
    input.wasPreviewStartAttempted !== true &&
    input.previewRenderable !== true;

  const terminalTruth = resolveBuildTerminalTruth({
    workflowEvents: input.workflowEvents,
    persistedFileCount: input.appFilesCount,
    memoryFileCount,
    failureKind: input.failureKind,
    previewStatus: previewNotStarted ? "not_started" : undefined,
    previewRenderable: input.previewRenderable,
    previewFailed: input.previewFailed,
    persistenceConfirmed: input.appFilesCount >= MIN_RENDERABLE_FILES,
  });

  const recoverable = hasRecoverableBuildFiles({
    persistedFileCount: input.appFilesCount,
    memoryFileCount,
    signals,
  });

  const previewFailed =
    input.previewFailed === true ||
    input.failureKind === "preview_failed" ||
    (terminalTruth.state === "files_generated_preview_repair" && input.wasPreviewStartAttempted === true);

  const previewPending =
    input.appFilesCount >= MIN_RENDERABLE_FILES &&
    input.previewSessionsCount === 0 &&
    !previewFailed &&
    !input.previewRenderable;

  let buildStatus: string;
  let jobStatus: "failed" | "completed" = "failed";

  if (input.appFilesCount >= MIN_RENDERABLE_FILES) {
    if (previewFailed) {
      buildStatus = "preview_failed";
    } else if (previewPending || terminalTruth.state === "files_generated_preview_pending") {
      buildStatus = "files_saved_preview_pending";
      jobStatus = "completed";
    } else if (input.previewRenderable) {
      buildStatus = "completed";
      jobStatus = "completed";
    } else {
      buildStatus = "files_saved_preview_pending";
      jobStatus = "completed";
    }
  } else if (recoverable && memoryFileCount >= MIN_RENDERABLE_FILES && input.appFilesCount === 0) {
    buildStatus = "needs_repair";
  } else if (recoverable && input.appFilesCount > 0) {
    buildStatus = "needs_repair";
  } else {
    buildStatus = "failed";
    jobStatus = "failed";
  }

  const failureKind =
    input.appFilesCount >= MIN_RENDERABLE_FILES
      ? previewFailed
        ? "preview_failed"
        : previewPending
          ? "files_generated_preview_pending"
          : null
      : recoverable && input.appFilesCount === 0 && memoryFileCount >= MIN_RENDERABLE_FILES
        ? "files_generated_needs_save_repair"
        : truthFailureKindForPersist(terminalTruth);

  const failureStage = failureStageFromSignals({
    appFilesCount: input.appFilesCount,
    wasPersistenceAttempted: input.wasPersistenceAttempted === true,
    wasPreviewStartAttempted: input.wasPreviewStartAttempted === true,
    previewFailed,
    failureKind,
  });

  const metadataPatch: Record<string, unknown> = {
    file_count: Math.max(input.appFilesCount, memoryFileCount, terminalTruth.fileCount),
    files_persist_confirmed: input.appFilesCount >= MIN_RENDERABLE_FILES,
    canonical_build_state:
      buildStatus === "preview_failed"
        ? "files_saved_preview_failed"
        : buildStatus === "files_saved_preview_pending"
          ? "files_saved_preview_pending"
          : buildStatus === "failed"
            ? "build_failed_no_files"
            : "build_complete_preview_ready",
    terminal_truth_state: terminalTruth.state,
    failure_kind: failureKind,
    failure_stage: failureStage,
    files_ready_preview_failed: buildStatus === "preview_failed",
    preview_renderable: input.previewRenderable === true,
  };

  if (previewPending) {
    metadataPatch.preview_status = "not_started";
  }

  return {
    buildStatus,
    jobStatus,
    failureKind,
    failureStage,
    headline: terminalTruth.headline,
    bodyLines: terminalTruth.bodyLines,
    terminalTruth,
    metadataPatch,
    shouldClearCatastrophicFailure: input.appFilesCount >= MIN_RENDERABLE_FILES || recoverable,
  };
}

function finalWorkflowEvent(events: BuildJobEventRow[]) {
  const last = events[events.length - 1];
  if (!last) {
    return { type: null, title: null, failure_kind: null, file_count: null };
  }
  const meta = last.metadata ?? {};
  return {
    type: last.type,
    title: last.title,
    failure_kind: typeof meta.failure_kind === "string" ? meta.failure_kind : null,
    file_count:
      typeof meta.file_count === "number"
        ? meta.file_count
        : typeof meta.files_persisted === "number"
          ? meta.files_persisted
          : null,
  };
}

export async function inspectBuildStateTruth(
  writer: Writer,
  projectId: string,
  _userId?: string,
): Promise<BuildStateDebugObject> {
  const { data: project } = await writer
    .from("projects")
    .select("id, owner_id, build_status, metadata")
    .eq("id", projectId)
    .maybeSingle();

  const meta = metaRecord(project?.metadata);
  const fileCountMetadata =
    typeof meta.file_count === "number" ? meta.file_count : Number(meta.file_count ?? 0) || 0;

  const { count: appFilesCount } = await writer
    .from("app_files")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  const previewSessionsCount = await countPreviewSessions(writer, projectId);
  const previewBuildJobsCount = await countPreviewBuildJobs(writer, projectId);

  const { data: latestJob } = await writer
    .from("build_jobs")
    .select("id, status, error_message")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const buildJobId = latestJob?.id ?? null;

  let workflowEvents: BuildJobEventRow[] = [];
  if (buildJobId) {
    workflowEvents = await loadBuildJobEvents(writer, buildJobId);
  }

  const finalEv = finalWorkflowEvent(workflowEvents);
  const wasPersistenceAttempted = workflowEvents.some(
    (e) => e.type === "saving_files" || e.detail?.includes("files in memory"),
  );
  const wasPreviewStartAttempted = workflowEvents.some((e) => e.type === "preparing_preview");

  const resolved = resolvePersistedBuildStatus({
    appFilesCount: appFilesCount ?? 0,
    previewSessionsCount,
    workflowEvents,
    failureKind: finalEv.failure_kind ?? (typeof meta.failure_kind === "string" ? meta.failure_kind : null),
    failureMessage: latestJob?.error_message ?? null,
    previewRenderable: meta.preview_renderable === true,
    previewFailed:
      project?.build_status === "preview_failed" || meta.files_ready_preview_failed === true,
    wasPersistenceAttempted,
    wasPreviewStartAttempted,
  });

  const why: string[] = [];
  if (project?.build_status === "failed" && (appFilesCount ?? 0) >= MIN_RENDERABLE_FILES) {
    why.push("projects.build_status is failed but app_files_count >= 4 (stale finalizeBuildFailed)");
  }
  if (finalEv.failure_kind === "failed_before_generation" && (appFilesCount ?? 0) >= MIN_RENDERABLE_FILES) {
    why.push("terminal workflow event still failed_before_generation despite persisted files");
  }
  if (latestJob?.status === "failed" && resolved.jobStatus === "completed") {
    why.push("build_jobs.status failed but truth says files_saved_preview_pending");
  }
  if (why.length === 0 && project?.build_status === "failed") {
    why.push("build_status failed with insufficient recoverable files");
  }
  if (why.length === 0 && resolved.shouldClearCatastrophicFailure) {
    why.push("UI should not show catastrophic failure — check poll/cache");
  }

  return {
    project_id: projectId,
    build_job_id: buildJobId,
    build_status: project?.build_status ?? null,
    file_count_metadata: fileCountMetadata,
    app_files_count: appFilesCount ?? 0,
    preview_sessions_count: previewSessionsCount,
    preview_build_jobs_count: previewBuildJobsCount,
    final_workflow_event: finalEv,
    failure_kind: finalEv.failure_kind ?? resolved.failureKind,
    failure_stage: resolved.failureStage,
    failure_message: latestJob?.error_message ?? null,
    was_persistence_attempted: wasPersistenceAttempted,
    was_preview_start_attempted: wasPreviewStartAttempted,
    why_ui_shows_failed: why.join("; ") || "no stale failure detected",
    canonical_state: String(resolved.metadataPatch.canonical_build_state ?? ""),
    terminal_truth_state: resolved.terminalTruth.state,
  };
}
