import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProjectIconSvg } from "@/lib/projects/ensure-project-icon";

export const dynamic = "force-dynamic";

/**
 * App icon — prefers stored icon_svg (imported or generated), else deterministic initials.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("projects")
    .select("name, app_name, icon_svg")
    .eq("id", id)
    .maybeSingle();

  const title = row?.app_name?.trim() || row?.name?.trim() || "App";
  const svg = ensureProjectIconSvg(title, row?.icon_svg);

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
