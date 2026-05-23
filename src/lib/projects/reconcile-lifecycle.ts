import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  lifecyclePatch,
  legacyProjectStatus,
  normalizeProjectStatus,
  readLifecycleFromMetadata,
  type ProjectLifecycleStatus,
} from "@/lib/projects/project-lifecycle";
import { resolveDisplayPublicUrl } from "@/lib/publish/publish-service";

type Writer = SupabaseClient<Database>;

export async function reconcileProjectLifecycle(
  writer: Writer,
  projectId: string,
  userId: string,
): Promise<{ lifecycle: ProjectLifecycleStatus; reconciled: boolean; fileCount: number }> {
  const { data: project } = await writer
    .from("projects")
    .select("id, build_status, metadata, published_subdomain, preview_url, status")
    .eq("id", projectId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (!project) {
    return { lifecycle: "draft", reconciled: false, fileCount: 0 };
  }

  const { count: fileCount } = await writer
    .from("app_files")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  const files = fileCount ?? 0;

  const { data: activeJob } = await writer
    .from("build_jobs")
    .select("id, status")
    .eq("project_id", projectId)
    .in("status", ["running", "building", "queued"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const meta = readLifecycleFromMetadata(project.metadata);
  const publicUrl = resolveDisplayPublicUrl(project) ?? meta.public_url ?? null;

  const lifecycle = normalizeProjectStatus(
    {
      lifecycleStatus: meta.lifecycle_status,
      buildStatus: project.build_status,
      fileCount: files,
      hasActiveBuildJob: Boolean(activeJob?.id),
      buildJobStatus: activeJob?.status ?? null,
      publishedSubdomain: project.published_subdomain,
      publicUrl,
      previewUrl: project.preview_url,
      blueprintApproved: meta.blueprint_approved,
      hasBlueprint: Boolean(
        project.metadata &&
          typeof project.metadata === "object" &&
          !Array.isArray(project.metadata) &&
          ((project.metadata as Record<string, unknown>).blueprint ||
            (project.metadata as Record<string, unknown>).approved_blueprint),
      ),
    },
    project.metadata,
  );

  const stored = meta.lifecycle_status;
  const reconciled = stored !== lifecycle;

  if (reconciled) {
    const prevMeta =
      project.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
        ? (project.metadata as Record<string, unknown>)
        : {};
    await writer
      .from("projects")
      .update({
        status: legacyProjectStatus(lifecycle),
        metadata: { ...prevMeta, ...lifecyclePatch(lifecycle) },
      } as never)
      .eq("id", projectId)
      .eq("owner_id", userId);
  }

  return { lifecycle, reconciled, fileCount: files };
}
