import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { slugifyAppName } from "@/lib/publish/app-slug";
import type { Json } from "@/lib/supabase/types";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: sourceId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const writer = createServiceRoleClient() ?? supabase;

  const { data: source, error: srcErr } = await writer
    .from("projects")
    .select("id, name, app_name, short_description, description, framework, gradient, icon_url, icon_svg, metadata")
    .eq("id", sourceId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (srcErr || !source) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const baseName = (source.app_name ?? source.name ?? "App").trim();
  const cloneName = `${baseName} (copy)`;
  const slug = `${slugifyAppName(cloneName)}-${Date.now().toString(36).slice(-4)}`.slice(0, 48);

  const meta =
    source.metadata && typeof source.metadata === "object" && !Array.isArray(source.metadata)
      ? { ...(source.metadata as Record<string, unknown>), cloned_from: sourceId }
      : { cloned_from: sourceId };

  const { data: created, error: insErr } = await writer
    .from("projects")
    .insert({
      owner_id: user.id,
      name: cloneName,
      app_name: cloneName,
      slug,
      short_description: source.short_description ?? source.description,
      description: source.description,
      framework: source.framework ?? "next",
      gradient: source.gradient ?? "from-blue-500/20 to-violet-500/10",
      icon_url: source.icon_url,
      icon_svg: source.icon_svg,
      status: "draft",
      is_public: false,
      metadata: meta as Json,
    } as never)
    .select("id")
    .single();

  if (insErr || !created) {
    return NextResponse.json({ error: insErr?.message ?? "Clone failed" }, { status: 500 });
  }

  const { data: files } = await writer
    .from("app_files")
    .select("path, content, mime_type, size_bytes, source")
    .eq("project_id", sourceId)
    .eq("owner_id", user.id);

  if (files?.length) {
    const rows = files.map((f) => ({
      project_id: created.id,
      owner_id: user.id,
      path: f.path,
      content: f.content,
      mime_type: f.mime_type,
      size_bytes: f.size_bytes,
      source: f.source ?? "clone",
    }));
    await writer.from("app_files").insert(rows);
  }

  return NextResponse.json({ id: created.id, slug });
}
