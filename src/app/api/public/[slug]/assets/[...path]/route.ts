import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { downloadPreviewArtifactFile } from "@/lib/imports/preview-artifact-writer";
import { loadPublishedAppBySlug } from "@/lib/publish/published-app-runtime";

export const dynamic = "force-dynamic";

function contentTypeFor(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "html") return "text/html; charset=utf-8";
  if (ext === "js" || ext === "mjs") return "application/javascript; charset=utf-8";
  if (ext === "css") return "text/css; charset=utf-8";
  if (ext === "json") return "application/json; charset=utf-8";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "woff2") return "font/woff2";
  if (ext === "woff") return "font/woff";
  if (ext === "ico") return "image/x-icon";
  return "application/octet-stream";
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string; path: string[] }> },
) {
  const { slug, path: segments } = await ctx.params;
  const safe = slug?.trim().toLowerCase();
  if (!safe || !segments?.length) return new NextResponse("Not found", { status: 404 });

  const published = await loadPublishedAppBySlug(safe);
  if (!published?.artifact_path) return new NextResponse("Not found", { status: 404 });

  const admin = createServiceRoleClient();
  if (!admin) return new NextResponse("Unavailable", { status: 503 });

  const relativePath = segments.join("/");
  const file = await downloadPreviewArtifactFile({
    admin,
    artifactPath: published.artifact_path,
    relativePath,
  });

  if (!file?.data) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType || contentTypeFor(relativePath),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
