import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getProjectAccess } from "@/lib/projects/project-access";
import { cleanAppName, stripMarkdownNoise } from "@/lib/projects/clean-app-name";

export { stripMarkdownNoise } from "@/lib/projects/clean-app-name";

type Writer = SupabaseClient<Database>;

/** Reject generic model names; derive brandable name from prompt when weak. */
export function refineAppName(candidate: string, userPrompt: string): string {
  return cleanAppName(candidate, userPrompt);
}

export async function loadProjectContextBlock(
  writer: Writer,
  projectId: string,
  userId: string,
): Promise<string> {
  const lines: string[] = [];

  const access = await getProjectAccess(writer, userId, projectId);
  if (!access) return "";

  const { data: project } = await writer
    .from("projects")
    .select("name, description, app_name, build_status, metadata, slug, framework, last_build_at")
    .eq("id", projectId)
    .maybeSingle();

  if (project) {
    const appName =
      (project as { app_name?: string | null }).app_name?.trim() || project.name?.trim();
    if (appName) lines.push(`App name: ${appName}`);
    if (project.description) lines.push(`Description: ${project.description}`);
    if (project.slug) lines.push(`Slug: ${project.slug}`);
    if ((project as { build_status?: string }).build_status) {
      lines.push(`Build status: ${(project as { build_status: string }).build_status}`);
    }
    if ((project as { last_build_at?: string }).last_build_at) {
      lines.push(`Last build: ${(project as { last_build_at: string }).last_build_at}`);
    }
    lines.push(`Framework: ${project.framework}`);
  }

  const { data: latestBuild } = await writer
    .from("build_jobs")
    .select("status, completed_at, credits_charged, error_message")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestBuild) {
    lines.push(`Latest build job: ${latestBuild.status}`);
    if (latestBuild.error_message) lines.push(`Build error: ${latestBuild.error_message}`);
  }

  const { count } = await writer
    .from("app_files")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  lines.push(`Generated files: ${count ?? 0}`);

  const { data: fileSample } = await writer
    .from("app_files")
    .select("path")
    .eq("project_id", projectId)
    .order("path")
    .limit(40);

  if (fileSample?.length) {
    lines.push("File paths:");
    for (const f of fileSample) lines.push(`- ${f.path}`);
    if ((count ?? 0) > 40) lines.push(`- …and ${(count ?? 0) - 40} more`);
  }

  return lines.join("\n");
}
