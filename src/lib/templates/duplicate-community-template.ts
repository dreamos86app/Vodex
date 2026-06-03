import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { mergeMobileBaselineIntoFiles } from "@/lib/generated-apps/mobile-baseline";
import { buildTemplateIconSvg } from "@/lib/templates/template-icons";
import { buildProjectBannerSvg } from "@/lib/projects/build-project-banner-svg";
import { lifecyclePatch } from "@/lib/projects/project-lifecycle";
import { slugifyAppName } from "@/lib/publish/app-slug";
import type { Json } from "@/lib/supabase/types";
import type { AppFileInsertRow } from "@/lib/projects/app-file-rows";
import type { DuplicateTemplateResult } from "@/lib/templates/duplicate-template-to-project";

const BATCH = 80;

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

export async function duplicateCommunityTemplateToProject(args: {
  supabase: SupabaseClient<Database>;
  userId: string;
  templateId: string;
}): Promise<DuplicateTemplateResult> {
  const { data: row, error: tplErr } = await args.supabase
    .from("templates")
    .select(
      "id, name, description, accent, category, source_project_id, is_official, visibility, owner_id",
    )
    .eq("id", args.templateId)
    .maybeSingle();

  if (tplErr || !row) {
    return { ok: false, error: "Template not found", code: "template_not_found" };
  }

  if (row.is_official) {
    return { ok: false, error: "Use official template API", code: "template_not_found" };
  }

  if (row.visibility !== "public" && row.owner_id !== args.userId) {
    return { ok: false, error: "Template not available", code: "template_not_found" };
  }

  const { data: fileRows, error: filesErr } = await args.supabase
    .from("template_files")
    .select("path, content")
    .eq("template_id", args.templateId);

  if (filesErr || !fileRows?.length) {
    return { ok: false, error: "Template has no source files", code: "template_empty" };
  }

  const templateName = row.name.trim();
  const accent = row.accent ?? "#38bdf8";
  const appId = `dev.vodex.community.${row.id.replace(/-/g, "").slice(0, 12)}`;
  const sourceFiles = mergeMobileBaselineIntoFiles(
    fileRows.map((f) => ({ path: f.path, content: f.content })),
    { appName: templateName, appId, themeColor: accent, description: row.description },
  );

  const slug = `${slugifyAppName(templateName)}-tpl-${Date.now().toString(36).slice(-6)}`;
  const iconSvg = buildTemplateIconSvg(templateName, accent);
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
      template_id: row.id,
      metadata: {
        source: "template",
        community_template_id: row.id,
        template_name: templateName,
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

  const rows: AppFileInsertRow[] = sourceFiles.map((f) => ({
    project_id: project.id,
    owner_id: args.userId,
    path: f.path,
    content: f.content,
    mime_type: mimeForPath(f.path),
    size_bytes: new TextEncoder().encode(f.content).length,
    source: "template",
  }));

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

  await args.supabase.from("template_usage_events").insert({
    template_id: row.id,
    user_id: args.userId,
    project_id: project.id,
  } as never);

  return {
    ok: true,
    projectId: project.id,
    slug,
    templateName,
    fileCount: sourceFiles.length,
  };
}
