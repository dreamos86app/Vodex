import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { reconcileProjectLifecycle } from "@/lib/projects/reconcile-lifecycle";
import { completeBuildWithValidation } from "@/lib/build/complete-build-with-validation";
type Writer = SupabaseClient<Database>;

const STALE_BUILD_MS = 20 * 60 * 1000;

/** Align build_jobs + projects with app_files reality (publish readiness). */
export async function reconcileProjectBuildState(
  writer: Writer,
  projectId: string,
  userId: string,
): Promise<{
  fileCount: number;
  buildCompleted: boolean;
  buildStatus: string | null;
  reconciled: boolean;
}> {
  const { count: fileCount } = await writer
    .from("app_files")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  const files = fileCount ?? 0;

  const { data: project } = await writer
    .from("projects")
    .select("build_status, app_name, metadata, name")
    .eq("id", projectId)
    .eq("owner_id", userId)
    .maybeSingle();

  const { data: latestBuild } = await writer
    .from("build_jobs")
    .select("id, status, updated_at, created_at, completed_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let buildStatus = latestBuild?.status ?? null;
  let reconciled = false;
  const now = Date.now();

  if (
    latestBuild &&
    (latestBuild.status === "running" || latestBuild.status === "building") &&
    new Date(latestBuild.updated_at ?? latestBuild.created_at).getTime() < now - STALE_BUILD_MS
  ) {
    await writer
      .from("build_jobs")
      .update({
        status: "failed",
        error_message: "Build timed out — marked stale by system",
        completed_at: new Date().toISOString(),
      } as never)
      .eq("id", latestBuild.id);
    buildStatus = "failed";
    reconciled = true;
  }

  const projectBuildStatus = project?.build_status ?? null;
  let buildCompleted =
    buildStatus === "completed" ||
    buildStatus === "succeeded" ||
    projectBuildStatus === "completed";

  if (files > 0 && !buildCompleted && latestBuild?.status !== "failed") {
    if (latestBuild?.id) {
      await writer
        .from("build_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          error_message: null,
          result_summary: `Reconciled — ${files} file(s) on disk`,
        } as never)
        .eq("id", latestBuild.id);

      await writer
        .from("projects")
        .update({
          build_status: "completed",
          last_build_id: latestBuild.id,
          last_build_at: new Date().toISOString(),
        } as never)
        .eq("id", projectId)
        .eq("owner_id", userId);

      await completeBuildWithValidation({ writer, userId, projectId });
    } else {
      const meta =
        project?.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
          ? (project.metadata as Record<string, unknown>)
          : {};
      const isImport = meta.source === "zip_import";

      await writer
        .from("projects")
        .update({
          build_status: isImport ? "imported" : "completed",
          metadata: {
            ...meta,
            file_count: files,
            build_reconciled_without_job: true,
            lifecycle_status: isImport
              ? meta.lifecycle_status ?? "imported_preview_ready"
              : meta.lifecycle_status ?? "generated",
          },
        } as never)
        .eq("id", projectId)
        .eq("owner_id", userId);
    }

    buildStatus = "completed";
    buildCompleted = true;
    reconciled = true;
  }

  await reconcileProjectLifecycle(writer, projectId, userId);

  return {
    fileCount: files,
    buildCompleted,
    buildStatus,
    reconciled,
  };
}
