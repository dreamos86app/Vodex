import type { SupabaseClient } from "@supabase/supabase-js";

export type PublishedSnapshotFile = { path: string; content: string };

export async function capturePublishedSnapshot(
  writer: SupabaseClient,
  projectId: string,
  userId: string,
): Promise<{ files: PublishedSnapshotFile[]; title: string; description: string | null }> {
  const { data: project } = await writer
    .from("projects")
    .select("name, description, short_description, app_name")
    .eq("id", projectId)
    .eq("owner_id", userId)
    .maybeSingle();

  const { data: fileRows } = await writer
    .from("app_files")
    .select("path, content")
    .eq("project_id", projectId)
    .limit(300);

  const files = (fileRows ?? [])
    .filter((f) => f.path && f.content != null)
    .map((f) => ({ path: f.path!, content: f.content! }));

  const title =
    (project as { app_name?: string })?.app_name?.trim() ||
    project?.name?.trim() ||
    "Published app";

  const description =
    (project as { short_description?: string })?.short_description?.trim() ||
    project?.description?.trim() ||
    null;

  return { files, title, description };
}

export type PublishedAppRow = {
  slug: string;
  public_url: string;
  title: string | null;
  description: string | null;
  snapshot_files: PublishedSnapshotFile[];
  version: number;
  project_id: string;
};
