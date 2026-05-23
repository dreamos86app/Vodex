import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildBannerForProject, readBannerSvg } from "@/lib/projects/backfill-project-media";

export const dynamic = "force-dynamic";

/** App card banner — metadata banner_svg or deterministic mock. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: row } = await supabase
    .from("projects")
    .select("id, name, app_name, framework, metadata, published_subdomain")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const stored = readBannerSvg(row.metadata);
  const svg = stored ?? buildBannerForProject(row);

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
