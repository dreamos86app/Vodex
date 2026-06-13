import type { SupabaseClient } from "@supabase/supabase-js";

const PAGE = 500;

/** Load all app_files rows for a project (paginated — Supabase default cap is 1000). */
export async function loadAllProjectAppFiles(
  client: SupabaseClient,
  projectId: string,
): Promise<Array<{ path: string; content: string }>> {
  const out: Array<{ path: string; content: string }> = [];
  let from = 0;
  while (true) {
    const { data, error } = await client
      .from("app_files")
      .select("path, content")
      .eq("project_id", projectId)
      .order("path")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    for (const row of data) {
      if (row.path) out.push({ path: row.path, content: row.content ?? "" });
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}
