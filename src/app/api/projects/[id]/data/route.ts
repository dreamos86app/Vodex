import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { detectAppDataCollections } from "@/lib/dashboard/detect-app-data-collections";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
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

  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ collections: [], unavailable: true });

  const { data: fileRows } = await admin
    .from("app_files")
    .select("path, content")
    .eq("project_id", projectId)
    .limit(400);

  const files = (fileRows ?? []).map((r) => ({
    path: String((r as { path?: string }).path ?? ""),
    content: String((r as { content?: string }).content ?? ""),
  }));

  const meta =
    project.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
      ? (project.metadata as Record<string, unknown>)
      : {};

  const collections = detectAppDataCollections({ files, metadata: meta });

  return NextResponse.json({
    collections,
    totalCollections: collections.length,
    totalRecords: collections.reduce((s, c) => s + (c.recordCount ?? 0), 0),
  });
}
