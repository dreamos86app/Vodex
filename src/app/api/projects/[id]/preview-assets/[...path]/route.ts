import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { downloadPreviewArtifactFile } from "@/lib/imports/preview-artifact-writer";
import { requireProjectId, jsonMissingId } from "@/lib/ids/required-ids";
import { stripPreviewPlatformPathsFromText } from "@/lib/preview/strip-preview-platform-paths";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string; path: string[] }> },
) {
  const { id: rawId, path: pathParts } = await ctx.params;
  const projectId = requireProjectId(rawId);
  if (!projectId) return jsonMissingId("projectId", "Project id is required.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("metadata")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!project) return new NextResponse("Not found", { status: 404 });

  const meta =
    project.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
      ? (project.metadata as Record<string, unknown>)
      : {};

  const url = new URL(req.url);
  const buildId = url.searchParams.get("build")?.trim();
  const artifactPath =
    (typeof meta.preview_artifact_path === "string" && meta.preview_artifact_path) ||
    (buildId ? `${projectId}/${buildId}` : null);

  if (!artifactPath) return new NextResponse("No preview artifact", { status: 404 });

  const admin = createSupabaseAdmin();
  if (!admin) return new NextResponse("Service unavailable", { status: 503 });

  let rel = pathParts?.length ? pathParts.join("/") : "index.html";
  let file = await downloadPreviewArtifactFile({
    admin,
    artifactPath,
    relativePath: rel,
  });

  const looksLikeAsset = /\.[a-z0-9]{1,8}$/i.test(rel.split("/").pop() ?? "");
  if (!file && !looksLikeAsset) {
    rel = "index.html";
    file = await downloadPreviewArtifactFile({
      admin,
      artifactPath,
      relativePath: rel,
    });
  }

  if (!file) return new NextResponse("Not found", { status: 404 });

  const lower = rel.toLowerCase();
  const isTextBundle =
    lower.endsWith(".js") ||
    lower.endsWith(".mjs") ||
    lower.endsWith(".html") ||
    lower.endsWith(".json") ||
    file.contentType.includes("javascript") ||
    file.contentType.includes("json");

  const body = isTextBundle
    ? Buffer.from(
        stripPreviewPlatformPathsFromText(file.data.toString("utf8"), projectId, { rewriteAssetUrls: false }),
        "utf8",
      )
    : file.data;

  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "private, no-store",
      "X-Frame-Options": "SAMEORIGIN",
    },
  });
}
