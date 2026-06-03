import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { slugifyAppName } from "@/lib/publish/app-slug";

export type PublishTemplateInput = {
  projectId: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  previewImageUrl: string | null;
  visibility: "public" | "unlisted" | "private";
};

export async function publishProjectAsTemplate(args: {
  supabase: SupabaseClient<Database>;
  userId: string;
  input: PublishTemplateInput;
}): Promise<{ ok: true; templateId: string } | { ok: false; error: string }> {
  const { projectId, title, description, category, tags, previewImageUrl, visibility } =
    args.input;

  const { data: project, error: projErr } = await args.supabase
    .from("projects")
    .select("id, owner_id, name, metadata")
    .eq("id", projectId)
    .eq("owner_id", args.userId)
    .maybeSingle();

  if (projErr || !project) {
    return { ok: false, error: "Project not found" };
  }

  const { data: appFiles, error: filesErr } = await args.supabase
    .from("app_files")
    .select("path, content, mime_type, size_bytes")
    .eq("project_id", projectId)
    .eq("owner_id", args.userId);

  if (filesErr || !appFiles?.length) {
    return { ok: false, error: "Add app files before publishing as a template" };
  }

  const slug = `${slugifyAppName(title)}-${Date.now().toString(36).slice(-5)}`;
  const meta = (project.metadata ?? {}) as Record<string, unknown>;
  const accent =
    typeof meta.accent === "string"
      ? meta.accent
      : typeof meta.theme_color === "string"
        ? meta.theme_color
        : "#6366f1";

  const { data: template, error: insErr } = await args.supabase
    .from("templates")
    .insert({
      name: title.trim(),
      description: description.trim(),
      category,
      gradient: "from-sky-500/15 via-indigo-500/10 to-violet-500/15",
      accent,
      tags,
      complexity: "medium",
      prompt: description.trim(),
      preview_url: previewImageUrl,
      preview_image_url: previewImageUrl,
      owner_id: args.userId,
      creator_id: args.userId,
      visibility,
      is_official: false,
      source_project_id: projectId,
      slug,
    } as never)
    .select("id")
    .single();

  if (insErr || !template?.id) {
    return { ok: false, error: insErr?.message ?? "Could not publish template" };
  }

  const templateFiles = appFiles.map((f) => ({
    template_id: template.id,
    path: f.path,
    content: f.content,
    mime_type: f.mime_type,
    size_bytes: f.size_bytes ?? new TextEncoder().encode(f.content).length,
  }));

  const { error: tfErr } = await args.supabase.from("template_files").insert(templateFiles as never);
  if (tfErr) {
    await args.supabase.from("templates").delete().eq("id", template.id);
    return { ok: false, error: tfErr.message };
  }

  return { ok: true, templateId: template.id };
}
