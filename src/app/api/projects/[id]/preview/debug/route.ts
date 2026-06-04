import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadPreviewRuntimeStatus } from "@/lib/preview/load-preview-runtime-status";
import { loadProjectFilesWithContent } from "@/lib/preview/project-preview-html";
import { detectPreviewRoutesFromFiles } from "@/lib/preview/detect-preview-routes";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: proj } = await supabase
    .from("projects")
    .select("id, metadata, preview_url")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!proj) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const meta =
    proj.metadata && typeof proj.metadata === "object" && !Array.isArray(proj.metadata)
      ? (proj.metadata as Record<string, unknown>)
      : {};

  const runtime = await loadPreviewRuntimeStatus(supabase, projectId, meta);
  const files = await loadProjectFilesWithContent(supabase, projectId);
  const routes = detectPreviewRoutesFromFiles(
    files.map((f) => ({ path: f.path, content: f.content })),
  );

  return NextResponse.json({
    projectId,
    previewUrl: proj.preview_url,
    metadata: {
      preview_renderable: meta.preview_renderable,
      preview_honest: meta.preview_honest,
      preview_artifact_path: meta.preview_artifact_path,
      preview_job_id: meta.preview_job_id,
      preview_status: meta.preview_status,
    },
    runtime,
    routes,
    fileCount: files.length,
  });
}
