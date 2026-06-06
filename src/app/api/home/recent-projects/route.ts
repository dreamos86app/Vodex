import { NextResponse } from "next/server";
import { getServerSessionUser } from "@/lib/auth/session";
import { readBannerSvg, buildBannerForProject } from "@/lib/projects/backfill-project-media";
import { ensureProjectIconSvg } from "@/lib/projects/ensure-project-icon";
import { isUserVisibleProject } from "@/lib/projects/user-visible-projects";
import { computeProjectCardStatus } from "@/lib/projects/project-card-status";
import { computeProjectCardUiState } from "@/lib/projects/project-visibility-status";
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

  const mapped = (data ?? [])
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
      const ui = computeProjectCardUiState({
        id: row.id,
        build_status: row.build_status,
        metadata: meta,
        published_subdomain: row.published_subdomain,
        preview_url: row.preview_url,
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
        visibility_status: ui.visibility_status,
        visibility_section: ui.visibility_section,
        status_label: ui.status_label,
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
    });

  const building: typeof mapped = [];
  const drafts: typeof mapped = [];
  const published: typeof mapped = [];
  const ready: typeof mapped = [];

  for (const p of mapped) {
    const bs = String(p.build_status ?? "").toLowerCase();
    if (p.published_subdomain?.trim()) {
      published.push(p);
    } else if (bs === "running" || bs === "building" || bs === "queued" || bs === "starting") {
      building.push(p);
    } else if (p.visibility_section === "drafts" || p.visibility_section === "failed_attempts") {
      drafts.push(p);
    } else {
      ready.push(p);
    }
  }

  const projects = [...published, ...ready, ...building, ...drafts].slice(0, 24);

  return NextResponse.json(
    {
      projects,
      sections: {
        drafts: drafts.slice(0, 12),
        building: building.slice(0, 12),
        published: published.slice(0, 12),
        ready: ready.slice(0, 12),
      },
    },
    {
      headers: {
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    },
  );
}
