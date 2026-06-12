import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isZipImportedAsset } from "@/lib/import/is-zip-imported-asset";

function normalizeAssetQuery(name: string): string[] {
  const trimmed = name.trim();
  const base = trimmed.split(/[/\\]/).pop() ?? trimmed;
  const stem = base.replace(/\.[^.]+$/, "");
  const lower = trimmed.toLowerCase();
  const baseLower = base.toLowerCase();
  const stemLower = stem.toLowerCase();
  return [...new Set([trimmed, base, stem, lower, baseLower, stemLower].filter(Boolean))];
}

/** Resolve imported ZIP / Ripo-style asset names to project media URLs. */
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

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(req.url);
  const name = url.searchParams.get("name")?.trim();
  if (!name) return NextResponse.json({ data: null, ok: false });

  const { data: assetsRaw } = await supabase
    .from("media_assets")
    .select("id, filename, public_url, mime_type, size_bytes, tags, storage_path, metadata" as never)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(400);

  type LookupAsset = {
    filename: string;
    public_url: string;
    tags?: unknown;
    storage_path?: string | null;
    metadata?: unknown;
  };
  const assets = (assetsRaw ?? []) as unknown as LookupAsset[];

  const queries = normalizeAssetQuery(name);

  const match =
    assets.find((a) => queries.includes(a.filename.toLowerCase())) ??
    assets.find((a) => {
      const fn = a.filename.toLowerCase();
      return queries.some((q) => fn.includes(q) || q.includes(fn));
    }) ??
    assets.find((a) => {
      if (!isZipImportedAsset(a)) return false;
      if (Array.isArray(a.tags)) {
        const hit = a.tags.some((t: unknown) => {
          const tag = String(t).toLowerCase();
          return queries.some(
            (q) => tag.includes(q) || tag.endsWith(q) || tag.replace(/__/g, "/").includes(q),
          );
        });
        if (hit) return true;
      }
      const meta = a.metadata;
      if (meta && typeof meta === "object" && !Array.isArray(meta)) {
        const zipPath = String((meta as { zip_import_path?: string }).zip_import_path ?? "").toLowerCase();
        return queries.some((q) => zipPath.includes(q) || zipPath.endsWith(q));
      }
      return false;
    }) ??
    assets.find((a) => {
      const path = String(a.storage_path ?? "").toLowerCase();
      return queries.some((q) => path.includes(q.replace(/\//g, "__")));
    });

  if (!match) {
    return NextResponse.json({ data: null, items: [], ok: true });
  }

  return NextResponse.json({
    data: match,
    items: [match],
    ok: true,
    url: match.public_url,
    public_url: match.public_url,
    animation_url: match.public_url,
    src: match.public_url,
  });
}
