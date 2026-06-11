import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { downloadPreviewArtifactFile } from "@/lib/imports/preview-artifact-writer";
import { injectPreviewShims, analyzeLegacyAdapter } from "@/lib/imports/base44-lovable-adapter";
import { detectImportedFramework } from "@/lib/imports/framework-detector";
import { rewritePreviewArtifactHtml } from "@/lib/preview/rewrite-preview-artifact-html";
import { assertPreviewBootstrapClean } from "@/lib/preview/preview-bootstrap-sanitizer";
import { buildPreviewBootstrapLeakPanel } from "@/lib/preview/preview-bootstrap-leak-panel";
import { mergePreviewIframeEmbedHeaders } from "@/lib/preview/preview-iframe-embed-headers";
import { resolvePreviewAuthPageHtml, previewAuthHtmlHeaders } from "@/lib/preview/preview-auth-pages";

export const dynamic = "force-dynamic";

const CACHE_HEADERS = { "Cache-Control": "no-store, max-age=0" } as const;

function previewHtmlHeaders(extra?: Record<string, string>): Record<string, string> {
  return mergePreviewIframeEmbedHeaders({
    ...CACHE_HEADERS,
    ...extra,
  });
}

/** Virtual preview path — browser URL is app route, not /api/projects/.../preview-html. */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ projectId: string; artifactId: string; path?: string[] }> },
) {
  const { projectId, artifactId, path: pathSegments } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: proj } = await supabase
    .from("projects")
    .select("id, name, app_name, icon_url, metadata")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!proj) return new NextResponse("Not found", { status: 404 });

  const meta =
    proj.metadata && typeof proj.metadata === "object" && !Array.isArray(proj.metadata)
      ? (proj.metadata as Record<string, unknown>)
      : {};

  const artifactPath =
    (typeof meta.preview_artifact_path === "string" && meta.preview_artifact_path) ||
    `${projectId}/${artifactId}`;

  const virtualRoute =
    pathSegments?.length ? `/${pathSegments.map(decodeURIComponent).join("/")}` : "/";

  const reqUrl = new URL(req.url);
  const queryRoute = reqUrl.searchParams.get("route")?.trim();
  const effectiveRoute =
    queryRoute && queryRoute !== "/"
      ? queryRoute.startsWith("/")
        ? queryRoute
        : `/${queryRoute}`
      : virtualRoute;

  const admin = createSupabaseAdmin();
  const authHtml = admin
    ? await resolvePreviewAuthPageHtml(
        admin,
        projectId,
        artifactId,
        effectiveRoute,
        meta,
        typeof proj.name === "string" ? proj.name : null,
        typeof proj.app_name === "string" ? proj.app_name : null,
        typeof proj.icon_url === "string" ? proj.icon_url : null,
      )
    : null;
  if (authHtml) {
    return new NextResponse(authHtml, {
      status: 200,
      headers: previewAuthHtmlHeaders(),
    });
  }

  const file = admin
    ? await downloadPreviewArtifactFile({ admin, artifactPath, relativePath: "index.html" })
    : null;
  if (!file) return new NextResponse("Artifact not found", { status: 404 });

  const shimHints = [{ path: "package.json", content: "{}", sizeBytes: 2 }];
  const fw = detectImportedFramework(shimHints);
  const legacy = analyzeLegacyAdapter(shimHints, fw);
  let html = injectPreviewShims(file.data.toString("utf8"), legacy);
  html = rewritePreviewArtifactHtml(html, projectId, artifactId, effectiveRoute);

  const bootstrapAssert = assertPreviewBootstrapClean(html, projectId);
  if (!bootstrapAssert.ok) {
    const leakPanel = buildPreviewBootstrapLeakPanel({
      projectId,
      leaks: bootstrapAssert.leaks,
      hydrationCount: bootstrapAssert.hydrationCount,
      repairUrl: `/api/projects/${projectId}/preview/inner-route-repair`,
    });
    return new NextResponse(leakPanel, {
      status: 200,
      headers: previewHtmlHeaders({
        "Content-Type": "text/html; charset=utf-8",
        "X-Preview-Renderable": "false",
      }),
    });
  }

  return new NextResponse(html, {
    status: 200,
    headers: previewHtmlHeaders({
      "Content-Type": "text/html; charset=utf-8",
      "X-Preview-Renderable": "true",
      "X-Preview-Virtual-Route": effectiveRoute,
    }),
  });
}
