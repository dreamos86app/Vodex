import type { SupabaseClient } from "@supabase/supabase-js";
import type { Json } from "@/lib/supabase/types";
import { ensureProjectIconSvg, isWeakIconSvg } from "@/lib/projects/ensure-project-icon";
import { buildProjectBannerSvg, type ProjectBannerKind } from "@/lib/projects/build-project-banner-svg";
import { isZipImportProject, readImportMeta } from "@/lib/projects/imported-project-state";
import { readLifecycleFromMetadata } from "@/lib/projects/project-lifecycle";

type ProjectRow = {
  id: string;
  name: string;
  app_name?: string | null;
  framework?: string | null;
  icon_svg?: string | null;
  published_subdomain?: string | null;
  metadata?: Json | null;
};

function metaRecord(metadata: Json | null | undefined): Record<string, unknown> {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

function bannerKind(row: ProjectRow, meta: Record<string, unknown>): ProjectBannerKind {
  if (row.published_subdomain || meta.lifecycle_status === "published") return "published";
  if (isZipImportProject(meta)) return "imported";
  const ls = readLifecycleFromMetadata(meta).lifecycle_status;
  if (ls === "generated" || ls === "preview_ready" || ls === "publish_ready") return "generated";
  return "draft";
}

export function resolveProjectDisplayName(row: ProjectRow, meta: Record<string, unknown>): string {
  if (typeof row.app_name === "string" && row.app_name.trim()) return row.app_name.trim();
  if (typeof meta.app_name === "string" && meta.app_name.trim()) return meta.app_name.trim();
  return row.name.trim() || "App";
}

export function buildBannerForProject(row: ProjectRow): string {
  const meta = metaRecord(row.metadata);
  const imp = readImportMeta(meta);
  return buildProjectBannerSvg({
    title: resolveProjectDisplayName(row, meta),
    framework: row.framework,
    fileCount: imp.file_count ?? undefined,
    routeCount: imp.routes?.length ?? undefined,
    kind: bannerKind(row, meta),
  });
}

export type BackfillResult = {
  iconUpdated: boolean;
  bannerUpdated: boolean;
  icon_svg: string;
  banner_svg: string;
};

/** Deterministic backfill — no AI, no provider cost. */
export async function backfillProjectMediaIfNeeded(
  writer: SupabaseClient,
  row: ProjectRow,
): Promise<BackfillResult> {
  const meta = metaRecord(row.metadata);
  const title = resolveProjectDisplayName(row, meta);
  const needsIcon = isWeakIconSvg(row.icon_svg);
  const bannerStored =
    typeof meta.banner_svg === "string" && meta.banner_svg.trim().length > 0 ? meta.banner_svg : null;
  const needsBanner = !bannerStored;

  const icon_svg = needsIcon ? ensureProjectIconSvg(title, row.icon_svg) : row.icon_svg!.trim();
  const banner_svg = bannerStored ?? buildBannerForProject(row);

  if (!needsIcon && !needsBanner) {
    return { iconUpdated: false, bannerUpdated: false, icon_svg, banner_svg };
  }

  const nextMeta = { ...meta, banner_svg } as Record<string, unknown>;
  const patch: Record<string, unknown> = { metadata: nextMeta as Json };
  if (needsIcon) patch.icon_svg = icon_svg;

  await writer.from("projects").update(patch).eq("id", row.id);

  return { iconUpdated: needsIcon, bannerUpdated: needsBanner, icon_svg, banner_svg };
}

export function readBannerSvg(metadata: Json | null | undefined): string | null {
  const meta = metaRecord(metadata);
  return typeof meta.banner_svg === "string" && meta.banner_svg.trim() ? meta.banner_svg.trim() : null;
}
