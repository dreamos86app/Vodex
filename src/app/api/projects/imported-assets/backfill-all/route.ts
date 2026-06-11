import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  importPreviewArtifactBinaryAssets,
  importZipBinaryAssets,
} from "@/lib/import/import-zip-binary-assets";
import { ZIP_IMPORT_BUCKET } from "@/lib/import/zip-storage";

/** Backfill binary assets for every ZIP-imported project owned by the current user. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 503 });
  }

  const { data: importedRows, error: listErr } = await supabase
    .from("imported_projects")
    .select("project_id, user_id, source_archive_path, meta")
    .eq("user_id", user.id);

  if (listErr) {
    return NextResponse.json({ error: listErr.message }, { status: 500 });
  }

  const { data: projects } = await supabase
    .from("projects")
    .select("id, metadata")
    .eq("owner_id", user.id);

  const projectMeta = new Map(
    (projects ?? []).map((p) => [
      p.id,
      p.metadata && typeof p.metadata === "object" && !Array.isArray(p.metadata)
        ? (p.metadata as Record<string, unknown>)
        : {},
    ]),
  );

  let totalImported = 0;
  let projectsProcessed = 0;
  const errors: string[] = [];
  const perProject: Array<{ projectId: string; imported: number; from_zip: number; from_artifact: number }> =
    [];

  for (const row of importedRows ?? []) {
    const projectId = row.project_id;
    const meta = projectMeta.get(projectId) ?? {};
    let zipImported = 0;
    let artifactImported = 0;

    const importedMeta =
      row.meta && typeof row.meta === "object" && !Array.isArray(row.meta)
        ? (row.meta as Record<string, unknown>)
        : {};
    const archivePath =
      row.source_archive_path ??
      (typeof importedMeta.storage_path === "string" ? importedMeta.storage_path : null);

    if (archivePath) {
      const { data: blob, error: dlErr } = await admin.storage
        .from(ZIP_IMPORT_BUCKET)
        .download(archivePath);
      if (dlErr || !blob) {
        errors.push(`${projectId}: ZIP archive missing (${dlErr?.message ?? "not found"})`);
      } else {
        const buf = Buffer.from(await blob.arrayBuffer());
        const zipResult = await importZipBinaryAssets({
          admin,
          zipBuffer: buf,
          userId: user.id,
          projectId,
        });
        zipImported = zipResult.imported;
        errors.push(...zipResult.errors.slice(0, 3).map((e) => `${projectId}: ${e}`));
      }
    } else {
      errors.push(`${projectId}: no source_archive_path`);
    }

    const artifactPath =
      (typeof meta.preview_artifact_path === "string" && meta.preview_artifact_path) || null;
    if (artifactPath) {
      const artifactResult = await importPreviewArtifactBinaryAssets({
        admin,
        userId: user.id,
        projectId,
        artifactPath,
      });
      artifactImported = artifactResult.imported;
      errors.push(...artifactResult.errors.slice(0, 3).map((e) => `${projectId}: ${e}`));
    }

    const imported = zipImported + artifactImported;
    if (imported > 0 || archivePath) {
      projectsProcessed += 1;
      totalImported += imported;
      perProject.push({
        projectId,
        imported,
        from_zip: zipImported,
        from_artifact: artifactImported,
      });
    }
  }

  return NextResponse.json({
    ok: totalImported > 0 || projectsProcessed > 0,
    projects_processed: projectsProcessed,
    imported: totalImported,
    per_project: perProject,
    errors: errors.slice(0, 25),
  });
}
