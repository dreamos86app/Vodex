import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/lib/supabase/types";
import type { PreviewFailureClassification } from "@/lib/preview/preview-failure-classifier";

export type LatestPreviewFailureRecord = PreviewFailureClassification & {
  captured_at: string;
  preview_session_id: string | null;
  preview_build_job_id: string | null;
  app_files_count: number;
  routes_count: number;
  package_json_exists: boolean;
  entrypoint_exists: boolean;
  preview_artifact_exists: boolean;
  generation_quality_score?: number | null;
  source_integrity_score?: number | null;
};

export function buildLatestPreviewFailureRecord(input: {
  classification: PreviewFailureClassification;
  previewSessionId?: string | null;
  previewBuildJobId?: string | null;
  appFilesCount: number;
  routesCount: number;
  packageJsonExists: boolean;
  entrypointExists: boolean;
  previewArtifactExists: boolean;
  generationQualityScore?: number | null;
  sourceIntegrityScore?: number | null;
}): LatestPreviewFailureRecord {
  return {
    ...input.classification,
    captured_at: new Date().toISOString(),
    preview_session_id: input.previewSessionId ?? null,
    preview_build_job_id: input.previewBuildJobId ?? null,
    app_files_count: input.appFilesCount,
    routes_count: input.routesCount,
    package_json_exists: input.packageJsonExists,
    entrypoint_exists: input.entrypointExists,
    preview_artifact_exists: input.previewArtifactExists,
    generation_quality_score: input.generationQualityScore ?? null,
    source_integrity_score: input.sourceIntegrityScore ?? null,
  };
}

export async function persistLatestPreviewFailure(input: {
  writer: SupabaseClient;
  projectId: string;
  ownerId: string;
  record: LatestPreviewFailureRecord;
  buildJobId?: string;
  previewSessionId?: string;
}): Promise<void> {
  const { data: proj } = await input.writer
    .from("projects")
    .select("metadata")
    .eq("id", input.projectId)
    .eq("owner_id", input.ownerId)
    .maybeSingle();

  const prevMeta =
    proj?.metadata && typeof proj.metadata === "object" && !Array.isArray(proj.metadata)
      ? (proj.metadata as Record<string, unknown>)
      : {};

  await input.writer
    .from("projects")
    .update({
      metadata: {
        ...prevMeta,
        latest_preview_failure: input.record as unknown as Json,
        preview_failure_kind: input.record.failure_kind,
        preview_failure_detail: input.record.failure_message,
        preview_error: input.record.human_summary,
        preview_error_code: input.record.failure_kind,
        last_preview_logs: input.record.build_logs_tail.slice(-50),
        files_ready_preview_failed: true,
        preview_build_status: "failed",
        generation_quality_score: input.record.generation_quality_score ?? prevMeta.generation_quality_score,
        source_integrity_score: input.record.source_integrity_score ?? prevMeta.source_integrity_score,
      } as Json,
    } as never)
    .eq("id", input.projectId)
    .eq("owner_id", input.ownerId);

  if (input.buildJobId) {
    const { data: job } = await input.writer
      .from("build_jobs")
      .select("meta")
      .eq("id", input.buildJobId)
      .maybeSingle();
    const jobMeta =
      job?.meta && typeof job.meta === "object" && !Array.isArray(job.meta)
        ? (job.meta as Record<string, unknown>)
        : {};
    await input.writer
      .from("build_jobs")
      .update({
        meta: {
          ...jobMeta,
          latest_preview_failure: input.record as unknown as Json,
          preview_build_status: "failed",
        } as Json,
      } as never)
      .eq("id", input.buildJobId);
  }

  if (input.previewSessionId) {
    try {
      await input.writer
        .from("preview_sessions" as never)
        .update({
          metadata: {
            latest_preview_failure: input.record,
            build_logs_tail: input.record.build_logs_tail,
            failure_kind: input.record.failure_kind,
            failure_message: input.record.failure_message,
          },
        } as never)
        .eq("id", input.previewSessionId);
    } catch {
      /* optional column */
    }
  }
}
