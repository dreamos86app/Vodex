import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireProjectId, jsonMissingId } from "@/lib/ids/required-ids";
import { loadPreviewRuntimeStatus } from "@/lib/preview/load-preview-runtime-status";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await ctx.params;
  const projectId = requireProjectId(rawId);
  if (!projectId) return jsonMissingId("projectId", "Project id is required.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("metadata, preview_url")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const meta =
    project.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
      ? (project.metadata as Record<string, unknown>)
      : {};

  const runtime = await loadPreviewRuntimeStatus(supabase, projectId, meta);

  return NextResponse.json({
    ...runtime,
    previewUrl: project.preview_url ?? null,
    previewHonest: runtime.previewHonest,
  });
}
