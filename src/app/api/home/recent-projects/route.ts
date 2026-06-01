import { NextResponse } from "next/server";
import { getServerSessionUser } from "@/lib/auth/session";
import { readBannerSvg, buildBannerForProject } from "@/lib/projects/backfill-project-media";
import { ensureProjectIconSvg } from "@/lib/projects/ensure-project-icon";
import { isUserVisibleProject } from "@/lib/projects/user-visible-projects";
import { computeProjectCardStatus } from "@/lib/projects/project-card-status";
import { resolveProjectDisplayName } from "@/lib/projects/provisional-app-name";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Fast home feed — no media backfill or lifecycle reconcile (keeps TTFB low). */
export async function GET() {
  const user = await getServerSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(
      "id, name, app_name, gradient, status, framework, updated_at, preview_url, icon_url, icon_svg, metadata, published_subdomain, build_status, is_favorite",
    )
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(24);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const projects = (data ?? [])
    .map((row) => {
      const meta =
        row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : {};
      const displayName = resolveProjectDisplayName({
        app_name: row.app_name,
        name: row.name,
      });
      const cardStatus = computeProjectCardStatus({
        build_status: row.build_status,
        metadata: meta,
      });
      return {
        id: row.id,
        name: displayName,
        gradient: row.gradient,
        status: row.status,
        framework: row.framework,
        updated_at: row.updated_at,
        preview_url: row.preview_url,
        icon_url: row.icon_url,
        icon_svg: ensureProjectIconSvg(displayName, row.icon_svg),
        banner_svg: readBannerSvg(row.metadata) ?? buildBannerForProject(row),
        build_status: row.build_status,
        card_status: cardStatus,
        published_subdomain: row.published_subdomain,
        metadata: meta,
        is_favorite: row.is_favorite ?? false,
      };
    })
    .filter(isUserVisibleProject)
    .sort((a, b) => {
      const favDiff = Number(Boolean(b.is_favorite)) - Number(Boolean(a.is_favorite));
      if (favDiff !== 0) return favDiff;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    })
    .slice(0, 12);

  return NextResponse.json(
    { projects },
    {
      headers: {
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    },
  );
}
