/**
 * P1.3.13 — Repair stale persisted build state (server runtime).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import type { BuildJobEventRow } from "@/lib/build/build-job-events";
import { persistBuildJobEvent } from "@/lib/build/build-job-events";
import { MIN_RENDERABLE_FILES } from "@/lib/build/build-success-contract";
import { lifecyclePatch } from "@/lib/projects/project-lifecycle";
import {
  inspectBuildStateTruth,
  loadBuildJobEvents,
  resolvePersistedBuildStatus,
  type BuildStateDebugObject,
  type ResolvedPersistedBuildState,
} from "@/lib/build/build-state-truth-resolver";

type Writer = SupabaseClient<Database>;

export type { BuildStateDebugObject, ResolvedPersistedBuildState };
export {
  inspectBuildStateTruth,
  resolvePersistedBuildStatus,
} from "@/lib/build/build-state-truth-resolver";

function metaRecord(meta: unknown): Record<string, unknown> {
  return meta && typeof meta === "object" && !Array.isArray(meta) ? (meta as Record<string, unknown>) : {};
}

export type RepairBuildStateResult = {
  applied: boolean;
  debug: BuildStateDebugObject;
  resolved: ResolvedPersistedBuildState;
  previewStartAttempted: boolean;
  previewStartOk: boolean;
};

export async function repairBuildStateTruth(
  writer: Writer,
  projectId: string,
  userId: string,
  options?: { startPreview?: boolean; apply?: boolean },
): Promise<RepairBuildStateResult> {
  const apply = options?.apply !== false;
  const debug = await inspectBuildStateTruth(writer, projectId, userId);

  const { data: project } = await writer
    .from("projects")
    .select("metadata, owner_id")
    .eq("id", projectId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (!project) {
    throw new Error("Project not found");
  }

  const meta = metaRecord(project.metadata);

  let workflowEvents: BuildJobEventRow[] = [];
  if (debug.build_job_id) {
    workflowEvents = await loadBuildJobEvents(writer, debug.build_job_id);
  }

  const resolved = resolvePersistedBuildStatus({
    appFilesCount: debug.app_files_count,
    previewSessionsCount: debug.preview_sessions_count,
    workflowEvents,
    failureKind: debug.failure_kind,
    failureMessage: debug.failure_message,
    previewRenderable: meta.preview_renderable === true,
    previewFailed: debug.build_status === "preview_failed" || meta.files_ready_preview_failed === true,
    wasPersistenceAttempted: debug.was_persistence_attempted,
    wasPreviewStartAttempted: debug.was_preview_start_attempted,
  });

  const needsRepair =
    debug.build_status === "failed" ||
    debug.final_workflow_event.failure_kind === "failed_before_generation" ||
    (debug.app_files_count >= MIN_RENDERABLE_FILES && debug.build_status !== resolved.buildStatus);

  let previewStartAttempted = false;
  let previewStartOk = false;

  if (apply && needsRepair) {
    const lifecycle =
      resolved.buildStatus === "failed"
        ? "failed"
        : resolved.buildStatus === "preview_failed"
          ? "needs_attention"
          : "generated";

    await writer
      .from("projects")
      .update({
        build_status: resolved.buildStatus,
        status: resolved.buildStatus === "failed" ? "error" : "draft",
        metadata: {
          ...meta,
          ...lifecyclePatch(lifecycle, {
            error: resolved.buildStatus === "failed" ? debug.failure_message : undefined,
            files_ready: debug.app_files_count >= MIN_RENDERABLE_FILES,
          }),
          ...resolved.metadataPatch,
          terminal_summary_headline: resolved.headline,
          terminal_summary_body: resolved.bodyLines.join(" "),
          build_state_repaired_at: new Date().toISOString(),
        } as Json,
      } as never)
      .eq("id", projectId)
      .eq("owner_id", userId);

    if (debug.build_job_id) {
      await writer
        .from("build_jobs")
        .update({
          status: resolved.jobStatus,
          error_message:
            resolved.jobStatus === "completed"
              ? null
              : (debug.failure_message ?? resolved.headline).slice(0, 2000),
          result_summary:
            resolved.jobStatus === "completed"
              ? `Repaired — ${debug.app_files_count} file(s); ${resolved.buildStatus}`
              : undefined,
          completed_at: new Date().toISOString(),
        } as never)
        .eq("id", debug.build_job_id);

      await persistBuildJobEvent(writer, {
        jobId: debug.build_job_id,
        projectId,
        userId,
        type: resolved.buildStatus === "failed" ? "failed" : "fixing_error",
        title: resolved.headline,
        detail: resolved.bodyLines.join(" "),
        progressPercent: 100,
        metadata: {
          failure_kind: resolved.failureKind,
          failure_stage: resolved.failureStage,
          file_count: debug.app_files_count,
          files_persisted: debug.app_files_count,
          files_persist_confirmed: debug.app_files_count >= MIN_RENDERABLE_FILES,
          build_state_repair: true,
          show_preview_actions: resolved.terminalTruth.showPreviewActions,
          show_repair_actions: resolved.terminalTruth.showRepairActions,
        },
      });
    }

    if (
      options?.startPreview !== false &&
      resolved.buildStatus === "files_saved_preview_pending" &&
      debug.preview_sessions_count === 0 &&
      debug.app_files_count >= MIN_RENDERABLE_FILES
    ) {
      previewStartAttempted = true;
      const { startPreviewSession } = await import("@/lib/preview/preview-build-service");
      const preview = await startPreviewSession({ writer, userId, projectId });
      previewStartOk = preview.ok;
      if (!preview.ok) {
        await writer
          .from("projects")
          .update({
            build_status: "preview_failed",
            metadata: {
              ...meta,
              ...resolved.metadataPatch,
              files_ready_preview_failed: true,
              preview_error: preview.error,
              preview_error_code: preview.code,
            } as Json,
          } as never)
          .eq("id", projectId)
          .eq("owner_id", userId);
      }
    }
  }

  const debugAfter = await inspectBuildStateTruth(writer, projectId, userId);

  return {
    applied: apply && needsRepair,
    debug: debugAfter,
    resolved,
    previewStartAttempted,
    previewStartOk,
  };
}
