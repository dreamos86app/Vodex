import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isHiddenGeneratedPath } from "@/lib/build/generated-file-utils";
import {
  buildStaticPreviewHtml,
  buildStaticPreviewHtmlDetailed,
  type PreviewHtmlOptions,
  type PreviewRendererSource,
} from "@/lib/preview/static-preview-builder";
import { analyzePreviewHtml, type PreviewHtmlDiagnostics } from "@/lib/preview/preview-html-diagnostics";
import type { Database } from "@/lib/supabase/types";

const PAGE = 500;

/** Fast path count — avoids loading file bodies (prevents statement timeouts on large ZIP imports). */
export async function countProjectFiles(
  client: SupabaseClient<Database>,
  projectId: string,
): Promise<number> {
  const { count, error } = await client
    .from("app_files")
    .select("path", { count: "exact", head: true })
    .eq("project_id", projectId);
  if (error) return 0;
  return count ?? 0;
}

export async function loadProjectFilesWithContent(
  client: SupabaseClient<Database>,
  projectId: string,
): Promise<Array<{ path: string; content: string }>> {
  const files: Array<{ path: string; content: string }> = [];
  let from = 0;
  while (true) {
    const { data, error } = await client
      .from("app_files")
      .select("path, content")
      .eq("project_id", projectId)
      .order("path")
      .range(from, from + PAGE - 1);
    if (error) break;
    if (!data?.length) break;
    for (const row of data) {
      if (row.path && !isHiddenGeneratedPath(row.path)) {
        files.push({ path: row.path, content: row.content ?? "" });
      }
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return files;
}

export type ProjectPreviewBuildMeta = {
  preview_renderer_source: PreviewRendererSource;
  preview_primary_file: string | null;
};

export function buildProjectPreviewHtml(
  files: Array<{ path: string; content: string }>,
  options?: PreviewHtmlOptions & { archetypeId?: string | null },
): string {
  return buildProjectPreviewHtmlDetailed(files, options).html;
}

export function buildProjectPreviewHtmlDetailed(
  files: Array<{ path: string; content: string }>,
  options?: PreviewHtmlOptions & { archetypeId?: string | null },
): { html: string; meta: ProjectPreviewBuildMeta } {
  const built = buildStaticPreviewHtmlDetailed(files, {
    projectId: options?.projectId,
    previewSessionId: options?.previewSessionId,
    archetypeId: options?.archetypeId,
  });
  return {
    html: built.html,
    meta: {
      preview_renderer_source: built.rendererSource,
      preview_primary_file: built.primaryFile,
    },
  };
}

export async function resolveProjectPreviewHtml(
  client: SupabaseClient<Database>,
  projectId: string,
  meta: Record<string, unknown>,
): Promise<{
  html: string;
  fileCount: number;
  archetypeId: string | null;
  diagnostics: PreviewHtmlDiagnostics;
}> {
  const archetypeId =
    (typeof meta.app_archetype === "string" && meta.app_archetype) ||
    (typeof meta.archetype_id === "string" && meta.archetype_id) ||
    null;
  const files = await loadProjectFilesWithContent(client, projectId);
  const html = buildProjectPreviewHtml(files, {
    projectId,
    archetypeId,
    previewSessionId:
      typeof meta.last_preview_session_id === "string" ? meta.last_preview_session_id : undefined,
  });
  const diagnostics = analyzePreviewHtml(html, files, {
    previewSessionOk: typeof meta.last_preview_session_id === "string",
  });
  return { html, fileCount: files.length, archetypeId, diagnostics };
}
