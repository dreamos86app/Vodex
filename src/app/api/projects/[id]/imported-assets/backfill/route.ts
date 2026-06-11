import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  importPreviewArtifactBinaryAssets,
  importZipBinaryAssets,
} from "@/lib/import/import-zip-binary-assets";
import { ZIP_IMPORT_BUCKET } from "@/lib/import/zip-storage";

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
  const { data: imported } = await supabase
    .from("imported_projects")
    .select("source_archive_path")
    .eq("project_id", projectId)
    .maybeSingle();

  if (imported?.source_archive_path) {
    const { data: blob, error: dlErr } = await admin.storage
      .from(ZIP_IMPORT_BUCKET)
      .download(imported.source_archive_path);
    if (dlErr || !blob) {
      zipResult.errors.push(dlErr?.message ?? "ZIP archive not found in storage");
    } else {
      const buf = Buffer.from(await blob.arrayBuffer());
      zipResult = await importZipBinaryAssets({
        admin,
        zipBuffer: buf,
        userId: user.id,
        projectId,
      });
    }
  } else {
    zipResult.errors.push("No imported_projects archive row for this project");
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

  return NextResponse.json({
    ok: totalImported > 0 || errors.length === 0,
    imported: totalImported,
    from_zip: zipResult.imported,
    from_artifact: artifactResult.imported,
    skipped: zipResult.skipped + artifactResult.skipped,
    errors,
  });
}
