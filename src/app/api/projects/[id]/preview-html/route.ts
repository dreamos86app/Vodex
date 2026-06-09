import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveProjectPreviewHtml } from "@/lib/preview/project-preview-html";
import { downloadPreviewArtifactFile } from "@/lib/imports/preview-artifact-writer";
import { analyzeLegacyAdapter, injectPreviewShims } from "@/lib/imports/base44-lovable-adapter";
import { detectImportedFramework } from "@/lib/imports/framework-detector";
import { analyzePreviewHtml } from "@/lib/preview/preview-html-diagnostics";
import { countProjectFiles, loadProjectFilesWithContent } from "@/lib/preview/project-preview-html";
import { rewritePreviewArtifactHtml } from "@/lib/preview/rewrite-preview-artifact-html";
import { loadPreviewRuntimeStatus } from "@/lib/preview/load-preview-runtime-status";
import { buildPreviewStatusHtml } from "@/lib/preview/preview-status-html";

export const dynamic = "force-dynamic";

function wantsHtmlFrame(req: Request): boolean {
  const url = new URL(req.url);
  if (url.searchParams.get("format") === "frame" || url.searchParams.get("format") === "html") {
    return true;
  }
  const accept = req.headers.get("accept") ?? "";
  return accept.includes("text/html");
}

function artifactBuildIdFromPath(
  artifactPath: string | null,
  projectId: string,
  queryBuild: string | null,
): string | null {
  if (queryBuild) return queryBuild;
  if (!artifactPath) return null;
  const parts = artifactPath.split("/");
  if (parts[0] === projectId && parts[1]) return parts[1];
  return parts[parts.length - 1] ?? null;
}

/** Preview status (JSON) or inline HTML frame (`?format=frame`) — never blank success. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return wantsHtmlFrame(req)
      ? new NextResponse("Unauthorized", { status: 401 })
      : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: proj } = await supabase
    .from("projects")
    .select("id, metadata")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!proj) {
    return wantsHtmlFrame(req)
      ? new NextResponse("Not found", { status: 404 })
      : NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const meta =
    proj.metadata && typeof proj.metadata === "object" && !Array.isArray(proj.metadata)
      ? (proj.metadata as Record<string, unknown>)
      : {};

  const url = new URL(req.url);
  const artifactBuild = url.searchParams.get("artifact")?.trim();
  const artifactPath =
    (typeof meta.preview_artifact_path === "string" && meta.preview_artifact_path) ||
    (artifactBuild ? `${projectId}/${artifactBuild}` : null);
  const buildId = artifactBuildIdFromPath(artifactPath, projectId, artifactBuild ?? null);

  const runtime = await loadPreviewRuntimeStatus(supabase, projectId, meta);

  let html = "";
  let fileCount = 0;
  let archetypeId: string | null = null;
  let diagnostics = analyzePreviewHtml("", []);
  let servedFromArtifact = false;

  const previewRoute = url.searchParams.get("route")?.trim() || "/";

  const metaRenderable =
    runtime.previewRenderable &&
    runtime.previewHonest &&
    (meta.preview_renderable === true ||
      runtime.jobStatus === "succeeded" ||
      Boolean(artifactPath && buildId));

  if (artifactPath && buildId && metaRenderable) {
    const admin = createSupabaseAdmin();
    const file = admin
      ? await downloadPreviewArtifactFile({
          admin,
          artifactPath,
          relativePath: "index.html",
        })
      : null;
    if (file) {
      const storedCount =
        typeof meta.import_file_count === "number" && meta.import_file_count > 0
          ? meta.import_file_count
          : null;
      fileCount = storedCount ?? (await countProjectFiles(supabase, projectId));
      const shimHints: Array<{ path: string; content: string; sizeBytes: number }> = [];
      for (const hintPath of ["package.json", ".env.example", "vite.config.ts"]) {
        const { data: hintRow } = await supabase
          .from("app_files")
          .select("content")
          .eq("project_id", projectId)
          .eq("path", hintPath)
          .maybeSingle();
        if (hintRow?.content) {
          shimHints.push({
            path: hintPath,
            content: hintRow.content,
            sizeBytes: Buffer.byteLength(hintRow.content, "utf8"),
          });
        }
      }
      const fw = detectImportedFramework(
        shimHints.length ? shimHints : [{ path: "package.json", content: "{}", sizeBytes: 2 }],
      );
      const legacy = analyzeLegacyAdapter(shimHints, fw);
      html = injectPreviewShims(file.data.toString("utf8"), legacy);
      html = rewritePreviewArtifactHtml(html, projectId, buildId, previewRoute);
      diagnostics = analyzePreviewHtml(html, shimHints.map((f) => ({ path: f.path, content: f.content })));
      servedFromArtifact = true;

      if (!diagnostics.previewRenderable) {
        runtime.blockedReason =
          runtime.blockedReason ??
          "Artifact served but no meaningful HTML rendered (missing root or empty document).";
        runtime.previewRenderable = false;
      } else {
        runtime.previewRenderable = true;
      }
    } else if (metaRenderable) {
      runtime.previewRenderable = false;
      runtime.blockedReason =
        "Preview marked ready but artifact index.html is missing from storage.";
    }
  }

  if (!html) {
    const resolved = await resolveProjectPreviewHtml(supabase, projectId, meta);
    html = resolved.html;
    fileCount = resolved.fileCount;
    archetypeId = resolved.archetypeId;
    diagnostics = resolved.diagnostics;
    runtime.previewRenderable = diagnostics.previewRenderable && meta.preview_honest !== false;
  }

  const frameRenderable = runtime.previewRenderable && diagnostics.previewRenderable && html.trim().length > 80;

  const cacheHeaders = {
    "Cache-Control": "no-store, max-age=0",
  };

  if (wantsHtmlFrame(req)) {
    if (!frameRenderable) {
      const statusHtml = buildPreviewStatusHtml(runtime, runtime.buildLogs ?? undefined);
      return new NextResponse(statusHtml, {
        status: 200,
        headers: {
          ...cacheHeaders,
          "Content-Type": "text/html; charset=utf-8",
          "X-Frame-Options": "SAMEORIGIN",
          "X-Preview-Renderable": "false",
        },
      });
    }

    return new NextResponse(html, {
      status: 200,
      headers: {
        ...cacheHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "X-Frame-Options": "SAMEORIGIN",
        "X-Preview-Renderable": "true",
        "X-Preview-Artifact": servedFromArtifact ? "1" : "0",
        "X-Preview-Source": servedFromArtifact ? "artifact_proxy" : "generated",
        "X-Preview-Route": previewRoute,
        "X-Preview-Spa-Fallback": previewRoute !== "/" && servedFromArtifact ? "1" : "0",
      },
    });
  }

  const importMeta =
    meta.import_validation && typeof meta.import_validation === "object"
      ? (meta.import_validation as Record<string, unknown>)
      : null;
  const legacyPlatform =
    typeof meta.legacy_platform === "string" ? meta.legacy_platform : null;

  return NextResponse.json(
    {
      ready: frameRenderable,
      previewRenderable: frameRenderable,
      previewHonest: meta.preview_honest === true,
      fileCount,
      archetypeId,
      previewHtmlLength: html.length,
      blockedReason: runtime.blockedReason ?? diagnostics.errorCode ?? null,
      errorMessage: runtime.blockedReason ?? diagnostics.errorMessage ?? null,
      sourceIntegrityOk: diagnostics.sourceIntegrityOk,
      hasRootElement: diagnostics.hasRootElement,
      servedFromArtifact,
      runtime,
      framework: importMeta?.framework ?? meta.imported_framework ?? null,
      entryFile: importMeta?.entryFile ?? meta.import_entry ?? null,
      previewEntry: importMeta?.previewEntry ?? null,
      legacyPlatform,
      buildCommand: importMeta?.buildCommand ?? null,
    },
    { headers: cacheHeaders },
  );
}
