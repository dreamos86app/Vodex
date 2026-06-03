import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getTemplateById } from "@/lib/templates/template-catalog";
import { getTemplateSourceFiles } from "@/lib/templates/template-source-files";
import { mergeMobileBaselineIntoFiles } from "@/lib/generated-apps/mobile-baseline";
import { buildTemplateIconSvg } from "@/lib/templates/template-icons";
import { buildProjectBannerSvg } from "@/lib/projects/build-project-banner-svg";
import { lifecyclePatch } from "@/lib/projects/project-lifecycle";
import { slugifyAppName } from "@/lib/publish/app-slug";
import type { Json } from "@/lib/supabase/types";
import type { AppFileInsertRow } from "@/lib/projects/app-file-rows";

const EXT_MIME: Record<string, string> = {
  ts: "text/typescript",
  tsx: "text/typescript",
  css: "text/css",
  md: "text/markdown",
  json: "application/json",
};

function mimeForPath(filePath: string): string {
  const ext = filePath.slice(filePath.lastIndexOf(".") + 1).toLowerCase();
  return EXT_MIME[ext] ?? "text/plain";
}

function buildTemplateAppFileRows(
  projectId: string,
  ownerId: string,
  files: { path: string; content: string }[],
): AppFileInsertRow[] {
  return files.map((f) => ({
    project_id: projectId,
    owner_id: ownerId,
    path: f.path,
    content: f.content,
    mime_type: mimeForPath(f.path),
    size_bytes: new TextEncoder().encode(f.content).length,
    source: "template",
  }));
}

const BATCH = 80;

export type DuplicateTemplateResult =
  | { ok: true; projectId: string; slug: string; templateName: string; fileCount: number }
  | { ok: false; error: string; code: string };

/**
 * Duplicates prebuilt template source files into a new user project.
 * Uses the catalog template name/icon — does not run AI identity generation.
 */
export async function duplicateTemplateToProject(args: {
  supabase: SupabaseClient<Database>;
  userId: string;
  templateId: string;
}): Promise<DuplicateTemplateResult> {
  const catalog = getTemplateById(args.templateId);
  if (!catalog) {
    return { ok: false, error: "Unknown template", code: "template_not_found" };
  }

  const appId = `dev.vodex.${catalog.id.replace(/[^a-z0-9]/gi, "")}`;
  const sourceFiles = mergeMobileBaselineIntoFiles(getTemplateSourceFiles(args.templateId), {
    appName: catalog.name,
    appId,
    themeColor: catalog.accent,
    description: catalog.description,
  });
  if (sourceFiles.length === 0) {
    return { ok: false, error: "Template has no source files", code: "template_empty" };
  }

  const templateName = catalog.name.trim();
  const slug = `${slugifyAppName(templateName)}-tpl-${Date.now().toString(36).slice(-6)}`;
  const iconSvg = buildTemplateIconSvg(templateName, catalog.accent);
  const bannerSvg = buildProjectBannerSvg({
    title: templateName,
    framework: "nextjs",
    fileCount: sourceFiles.length,
    routeCount: sourceFiles.filter((f) => f.path.includes("/page.tsx")).length,
    kind: "generated",
  });

  const lifecycleStatus = "preview_ready" as const;

  const { data: project, error: projErr } = await args.supabase
    .from("projects")
    .insert({
      owner_id: args.userId,
      name: templateName,
      app_name: templateName,
      slug,
      status: "draft",
      build_status: "generated",
      framework: "nextjs",
      icon_svg: iconSvg,
      metadata: {
        source: "template",
        template_id: catalog.id,
        template_name: templateName,
        template_prompt: catalog.prompt,
        skip_identity_generation: true,
        lifecycle_status: lifecycleStatus,
        preview_ready: true,
        preview_honest: true,
        banner_svg: bannerSvg,
        file_count: sourceFiles.length,
        duplicated_at: new Date().toISOString(),
        ...lifecyclePatch(lifecycleStatus),
      } as Json,
    } as never)
    .select("id")
    .single();

  if (projErr || !project?.id) {
    return {
      ok: false,
      error: projErr?.message ?? "Could not create project",
      code: "project_insert_failed",
    };
  }

  const rows = buildTemplateAppFileRows(project.id, args.userId, sourceFiles);

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error: fileErr } = await args.supabase.from("app_files").upsert(batch, {
      onConflict: "project_id,path",
    });
    if (fileErr) {
      await args.supabase.from("projects").delete().eq("id", project.id).eq("owner_id", args.userId);
      return { ok: false, error: fileErr.message, code: "app_files_insert_failed" };
    }
  }

  return {
    ok: true,
    projectId: project.id,
    slug,
    templateName,
    fileCount: sourceFiles.length,
  };
}
