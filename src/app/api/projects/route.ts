import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { reconcileProjectLifecycle } from "@/lib/projects/reconcile-lifecycle";
import {
  LIFECYCLE_META,
  readLifecycleFromMetadata,
  normalizeProjectStatus,
} from "@/lib/projects/project-lifecycle";
import { resolveDisplayPublicUrl } from "@/lib/publish/publish-service";
import {
  backfillProjectMediaIfNeeded,
  readBannerSvg,
} from "@/lib/projects/backfill-project-media";
import { isWeakIconSvg } from "@/lib/projects/ensure-project-icon";
import { isUserVisibleProject } from "@/lib/projects/user-visible-projects";
import { computeProjectCardStatus } from "@/lib/projects/project-card-status";

export const dynamic = "force-dynamic";

/** GET — list user projects with normalized lifecycle (server source of truth). */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const reconcile = url.searchParams.get("reconcile") === "1";
  const writer = createServiceRoleClient() ?? supabase;

  const { data: rows, error } = await writer
    .from("projects")
    .select(
      "id, name, slug, status, framework, gradient, icon_url, icon_svg, preview_url, published_subdomain, build_status, metadata, description, updated_at, created_at, app_name, short_description",
    )
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const projects = [];
  let backfillBudget = 16;
  /** Full reconcile on every row is O(n) DB work — cap so list stays responsive after create. */
  let reconcileBudget = reconcile ? 12 : 0;
  for (const row of rows ?? []) {
    let icon_svg = row.icon_svg;
    let banner_svg = readBannerSvg(row.metadata);
    let metadata = row.metadata;

    if (backfillBudget > 0 && (isWeakIconSvg(icon_svg) || !banner_svg)) {
      const filled = await backfillProjectMediaIfNeeded(writer, row);
      icon_svg = filled.icon_svg;
      banner_svg = filled.banner_svg;
      if (filled.iconUpdated || filled.bannerUpdated) {
        metadata = {
          ...(typeof metadata === "object" && metadata && !Array.isArray(metadata) ? metadata : {}),
          banner_svg,
        } as typeof metadata;
      }
      backfillBudget -= 1;
    }

    let lifecycle = readLifecycleFromMetadata(metadata).lifecycle_status;
    if (reconcile && reconcileBudget > 0) {
      const r = await reconcileProjectLifecycle(writer, row.id, user.id);
      lifecycle = r.lifecycle;
      reconcileBudget -= 1;
    } else if (!lifecycle) {
      lifecycle = normalizeProjectStatus(
        {
          lifecycleStatus: null,
          buildStatus: row.build_status,
          fileCount: 0,
          hasActiveBuildJob: false,
          publishedSubdomain: row.published_subdomain,
          previewUrl: row.preview_url,
          blueprintApproved: readLifecycleFromMetadata(metadata).blueprint_approved,
        },
        metadata,
      );
    }
    const metaObj =
      metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : {};
    const card_status = computeProjectCardStatus({
      build_status: row.build_status,
      metadata: metaObj,
    });
    const meta = LIFECYCLE_META[lifecycle];
    projects.push({
      ...row,
      icon_svg,
      banner_svg,
      metadata,
      lifecycle_status: lifecycle,
      lifecycle_label: meta.userLabel,
      card_status,
      public_url: resolveDisplayPublicUrl(row),
      show_in_dashboard: meta.showInDashboard,
      can_open_builder: meta.canOpenBuilder,
      can_preview: card_status === "ready",
      can_publish: meta.canPublish,
    });
  }

  const visible = projects.filter((row) => isUserVisibleProject(row as Parameters<typeof isUserVisibleProject>[0]));
  return NextResponse.json({ projects: visible });
}
