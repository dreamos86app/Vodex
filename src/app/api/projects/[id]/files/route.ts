import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PAGE = 1000;

/** List imported/generated file paths for builder (no file bodies). */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: proj } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!proj) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(req.url);
  const pathOnly = url.searchParams.get("path");
  if (pathOnly) {
    const { data, error } = await supabase
      .from("app_files")
      .select("path, content, source")
      .eq("project_id", projectId)
      .eq("path", pathOnly)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ file: data });
  }

  const paths: string[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("app_files")
      .select("path, source")
      .eq("project_id", projectId)
      .order("path")
      .range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data?.length) break;
    paths.push(...data.map((r) => r.path));
    if (data.length < PAGE) break;
    from += PAGE;
  }

  const zipCount = paths.length;
  return NextResponse.json({
    count: zipCount,
    paths,
    sources: ["generated", "zip_import", "edited"],
  });
}
