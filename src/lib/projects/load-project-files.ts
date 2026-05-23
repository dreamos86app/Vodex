import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type ProjectFileRef = { path: string; content: string; sizeBytes?: number };

const PAGE = 1000;

/** Paginated path listing — avoids loading all file bodies at once. */
export async function loadProjectFilePaths(
  client: SupabaseClient<Database>,
  projectId: string,
): Promise<{ paths: string[]; error?: string }> {
  const paths: string[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await client
      .from("app_files")
      .select("path")
      .eq("project_id", projectId)
      .order("path")
      .range(from, from + PAGE - 1);
    if (error) return { paths, error: error.message };
    if (!data?.length) break;
    paths.push(...data.map((r) => r.path));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return { paths };
}

export async function loadProjectFileContent(
  client: SupabaseClient<Database>,
  projectId: string,
  path: string,
): Promise<{ content: string; error?: string }> {
  const { data, error } = await client
    .from("app_files")
    .select("content")
    .eq("project_id", projectId)
    .eq("path", path)
    .maybeSingle();
  if (error) return { content: "", error: error.message };
  return { content: data?.content ?? "" };
}

/** Load paths + optional prefetch for entry files only. */
export async function loadProjectFilesForBuilder(
  client: SupabaseClient<Database>,
  projectId: string,
  prefetchPaths: string[] = [],
): Promise<{ files: ProjectFileRef[]; total: number; error?: string }> {
  const { paths, error } = await loadProjectFilePaths(client, projectId);
  if (error) return { files: [], total: 0, error };

  const prefetch = new Set(prefetchPaths.filter((p) => paths.includes(p)));
  const files: ProjectFileRef[] = paths.map((path) => ({
    path,
    content: prefetch.has(path) ? "" : "",
  }));

  await Promise.all(
    [...prefetch].map(async (path) => {
      const { content } = await loadProjectFileContent(client, projectId, path);
      const hit = files.find((f) => f.path === path);
      if (hit) hit.content = content;
    }),
  );

  return { files, total: paths.length };
}
