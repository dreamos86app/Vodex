import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PublishedAppRecord } from "@/lib/publish/published-app-runtime";

/** Resolve artifact storage path for a published app (published row or project metadata fallback). */
export async function resolvePublishedArtifactPath(
  published: Pick<PublishedAppRecord, "artifact_path" | "project_id">,
  admin: SupabaseClient,
): Promise<string | null> {
  const direct = published.artifact_path?.trim();
  if (direct) return direct;

  const { data: projectRow } = await admin
    .from("projects")
    .select("metadata")
    .eq("id", published.project_id)
    .maybeSingle();

  const meta =
    projectRow?.metadata && typeof projectRow.metadata === "object" && !Array.isArray(projectRow.metadata)
      ? (projectRow.metadata as Record<string, unknown>)
      : {};

  const fromMeta =
    typeof meta.preview_artifact_path === "string" ? meta.preview_artifact_path.trim() : "";
  return fromMeta || null;
}
