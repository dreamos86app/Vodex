import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  importPreviewArtifactBinaryAssets,
  importZipBinaryAssets,
} from "@/lib/import/import-zip-binary-assets";
import { persistImportedAppIconFromZip } from "@/lib/import/persist-imported-app-icon";
import { ZIP_IMPORT_BUCKET } from "@/lib/import/zip-storage";
import { reconcileZipPreviewCreditCapture } from "@/lib/imports/zip-preview-credit-reconcile";
import { collectReferencedAssetPaths } from "@/lib/import/collect-referenced-asset-paths";

/** Re-extract binary assets from stored ZIP archive and/or built preview artifact. */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("id, metadata")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 503 });
  }

  const meta =
    project.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
      ? (project.metadata as Record<string, unknown>)
      : {};

  let zipResult = { imported: 0, skipped: 0, errors: [] as string[] };

  const { data: appFileRows } = await supabase
    .from("app_files")
    .select("path, content")
    .eq("project_id", projectId)
    .limit(1500);
  const appFiles = (appFileRows ?? [])
    .filter((r): r is { path: string; content: string } => typeof r.path === "string" && typeof r.content === "string")
    .map((r) => ({ path: r.path, content: r.content }));
  const referencedPaths = collectReferencedAssetPaths(appFiles);

  const { data: imported } = await supabase
    .from("imported_projects")
    .select("source_archive_path, meta")
    .eq("project_id", projectId)
    .maybeSingle();

  const importedMeta =
    imported?.meta && typeof imported.meta === "object" && !Array.isArray(imported.meta)
      ? (imported.meta as Record<string, unknown>)
      : {};
  const archivePath =
    imported?.source_archive_path ??
    (typeof importedMeta.storage_path === "string" ? importedMeta.storage_path : null);

  let zipBuffer: Buffer | null = null;
  if (archivePath) {
    const { data: blob, error: dlErr } = await admin.storage
      .from(ZIP_IMPORT_BUCKET)
      .download(archivePath);
    if (dlErr || !blob) {
      zipResult.errors.push(dlErr?.message ?? "ZIP archive not found in storage");
    } else {
      zipBuffer = Buffer.from(await blob.arrayBuffer());
      zipResult = await importZipBinaryAssets({
        admin,
        zipBuffer,
        userId: user.id,
        projectId,
        appFiles,
        referencedPaths,
      });
    }
  } else {
    zipResult.errors.push("No imported_projects archive row for this project");
  }

  let iconPersist: { icon_url: string | null; icon_path: string | null } = {
    icon_url: null,
    icon_path: null,
  };
  if (zipBuffer) {
    const metaIconPath =
      typeof meta.icon_path === "string" ? meta.icon_path : null;
    iconPersist = await persistImportedAppIconFromZip({
      admin,
      userId: user.id,
      projectId,
      zipBuffer,
      preferredPath: metaIconPath,
    });
    if (iconPersist.icon_url || iconPersist.icon_path) {
      await supabase
        .from("projects")
        .update({
          ...(iconPersist.icon_url ? { icon_url: iconPersist.icon_url } : {}),
          metadata: {
            ...meta,
            icon_path: iconPersist.icon_path ?? metaIconPath,
            icon_source: iconPersist.icon_url ? "imported_binary" : meta.icon_source,
          },
        } as never)
        .eq("id", projectId)
        .eq("owner_id", user.id);
    }
  }

  let artifactResult = { imported: 0, skipped: 0, errors: [] as string[] };
  const artifactPath =
    (typeof meta.preview_artifact_path === "string" && meta.preview_artifact_path) || null;
  if (artifactPath) {
    artifactResult = await importPreviewArtifactBinaryAssets({
      admin,
      userId: user.id,
      projectId,
      artifactPath,
    });
  }

  const totalImported = zipResult.imported + artifactResult.imported;
  const errors = [...zipResult.errors, ...artifactResult.errors].slice(0, 15);

  const previewRenderable = meta.preview_renderable === true || meta.preview_ready === true;
  let creditCapture: { action: string; charged: number } | null = null;
  if (previewRenderable) {
    const reconcile = await reconcileZipPreviewCreditCapture({
      projectId,
      ownerId: user.id,
      jobStatus: "ready",
      previewRenderable: true,
      admin,
    });
    creditCapture = { action: reconcile.action, charged: reconcile.charged };
  }

  return NextResponse.json({
    ok: totalImported > 0 || errors.length === 0,
    imported: totalImported,
    from_zip: zipResult.imported,
    from_artifact: artifactResult.imported,
    skipped: zipResult.skipped + artifactResult.skipped,
    referenced_paths: referencedPaths.size,
    icon_url: iconPersist.icon_url,
    errors,
    creditCapture,
  });
}
