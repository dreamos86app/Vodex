import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { persistImportedAppIconFromZip } from "@/lib/import/persist-imported-app-icon";
import { ensureProjectIconSvg, isWeakIconSvg } from "@/lib/projects/ensure-project-icon";
import { isZipImportProject } from "@/lib/projects/imported-project-state";
import { ZIP_IMPORT_BUCKET } from "@/lib/import/zip-storage";

type ProjectIconRow = {
  id: string;
  owner_id: string;
  name: string;
  app_name?: string | null;
  icon_url?: string | null;
  icon_svg?: string | null;
  metadata?: unknown;
};

function metaRecord(metadata: unknown): Record<string, unknown> {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

function displayName(row: ProjectIconRow, meta: Record<string, unknown>): string {
  if (typeof row.app_name === "string" && row.app_name.trim()) return row.app_name.trim();
  if (typeof meta.app_name === "string" && meta.app_name.trim()) return meta.app_name.trim();
  return row.name.trim() || "App";
}

/** Fill missing icon_url / weak icon_svg from ZIP archive or deterministic SVG. */
export async function backfillProjectIconIfMissing(
  writer: SupabaseClient,
  row: ProjectIconRow,
): Promise<{ updated: boolean; icon_url: string | null; icon_svg: string | null }> {
  const meta = metaRecord(row.metadata);
  const title = displayName(row, meta);
  const hasIconUrl = Boolean(row.icon_url?.trim());
  const needsSvg = isWeakIconSvg(row.icon_svg);
  const icon_svg = needsSvg ? ensureProjectIconSvg(title, row.icon_svg) : row.icon_svg?.trim() ?? null;

  if (hasIconUrl && !needsSvg) {
    return { updated: false, icon_url: row.icon_url ?? null, icon_svg };
  }

  let icon_url = row.icon_url?.trim() ?? null;

  if (!hasIconUrl && isZipImportProject(meta)) {
    const admin = createSupabaseAdmin();
    if (admin) {
      const { data: imported } = await writer
        .from("imported_projects")
        .select("source_archive_path")
        .eq("project_id", row.id)
        .maybeSingle();

      const archivePath = imported?.source_archive_path ?? null;
      const iconPath = typeof meta.icon_path === "string" ? meta.icon_path : null;

      if (archivePath) {
        const { data: blob } = await admin.storage.from(ZIP_IMPORT_BUCKET).download(archivePath);
        if (blob) {
          const zipBuffer = Buffer.from(await blob.arrayBuffer());
          const persisted = await persistImportedAppIconFromZip({
            admin,
            userId: row.owner_id,
            projectId: row.id,
            zipBuffer,
            preferredPath: iconPath,
          });
          if (persisted.icon_url) icon_url = persisted.icon_url;
        }
      }
    }
  }

  const patch: Record<string, unknown> = {};
  if (needsSvg && icon_svg) patch.icon_svg = icon_svg;
  if (icon_url && icon_url !== row.icon_url) patch.icon_url = icon_url;
  if (Object.keys(patch).length === 0) {
    return { updated: false, icon_url: row.icon_url ?? null, icon_svg: row.icon_svg ?? icon_svg };
  }

  await writer.from("projects").update(patch as never).eq("id", row.id);

  return {
    updated: true,
    icon_url: icon_url ?? row.icon_url ?? null,
    icon_svg: (patch.icon_svg as string | undefined) ?? row.icon_svg ?? icon_svg,
  };
}
