import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isZipImportedAsset } from "@/lib/import/is-zip-imported-asset";

/** List media_assets for a project (resilient column selection). */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const admin = createSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Server configuration error" }, { status: 503 });

  type AssetRow = {
    id: string;
    filename: string;
    public_url: string;
    mime_type: string;
    size_bytes: number;
    created_at: string;
    tags?: unknown;
    metadata?: unknown;
    storage_path?: string;
    asset_type?: string;
  };

  let assets: AssetRow[] = [];
  const full = await admin
    .from("media_assets")
    .select(
      "id, filename, public_url, mime_type, size_bytes, created_at, tags, metadata, storage_path, asset_type" as never,
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (!full.error) {
    assets = (full.data ?? []) as unknown as AssetRow[];
  } else {
    const slim = await admin
      .from("media_assets")
      .select("id, filename, public_url, mime_type, size_bytes, created_at, storage_path" as never)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (slim.error) {
      return NextResponse.json({ error: slim.error.message, assets: [] }, { status: 500 });
    }
    assets = (slim.data ?? []) as unknown as AssetRow[];
  }

  const imported = assets.filter((a) => isZipImportedAsset(a));
  const uploaded = assets.filter((a) => !isZipImportedAsset(a));

  return NextResponse.json({
    assets,
    imported,
    uploaded,
    total: assets.length,
    importedCount: imported.length,
  });
}
