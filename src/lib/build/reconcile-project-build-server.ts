/**
 * Server-only reconcile — may repair stale build_status and start preview.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { MIN_RENDERABLE_FILES } from "@/lib/build/build-success-contract";
import { repairBuildStateTruth } from "@/lib/build/build-state-truth-repair";
import { reconcileProjectBuildState } from "@/lib/build/reconcile-project-build";

type Writer = SupabaseClient<Database>;

export async function reconcileProjectBuildStateServer(
  writer: Writer,
  projectId: string,
  userId: string,
  options?: { startPreview?: boolean },
): Promise<{
  fileCount: number;
  buildCompleted: boolean;
  buildStatus: string | null;
  reconciled: boolean;
  buildStateRepaired: boolean;
}> {
  const base = await reconcileProjectBuildState(writer, projectId, userId);

  const { count: fileCount } = await writer
    .from("app_files")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);
  const files = fileCount ?? 0;

  const { data: project } = await writer
    .from("projects")
    .select("build_status")
    .eq("id", projectId)
    .eq("owner_id", userId)
    .maybeSingle();

  const { data: latestBuild } = await writer
    .from("build_jobs")
    .select("status")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let buildStateRepaired = false;
  let buildStatus = base.buildStatus;
  let buildCompleted = base.buildCompleted;
  let reconciled = base.reconciled;

  if (
    files >= MIN_RENDERABLE_FILES &&
    (latestBuild?.status === "failed" ||
      project?.build_status === "failed" ||
      project?.build_status === "needs_repair")
  ) {
    const repaired = await repairBuildStateTruth(writer, projectId, userId, {
      startPreview: options?.startPreview !== false,
      apply: true,
    });
    if (repaired.applied) {
      buildStateRepaired = true;
      reconciled = true;
      buildStatus = repaired.resolved.buildStatus === "failed" ? "failed" : "completed";
      buildCompleted = repaired.resolved.jobStatus === "completed";
    }
  }

  return {
    fileCount: base.fileCount,
    buildCompleted,
    buildStatus,
    reconciled,
    buildStateRepaired,
  };
}
