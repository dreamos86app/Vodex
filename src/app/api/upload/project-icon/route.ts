import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { ensurePublicBucket } from "@/lib/supabase/ensure-storage-bucket";
import { notifyProjectCatalogUpdated } from "@/lib/projects/project-catalog-sync";

const BUCKET = "project-icons";
const MAX_SIZE = 2 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const projectId = String(formData.get("projectId") ?? "").trim();

  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
  if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "Max 2 MB" }, { status: 400 });

  const allowed = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: "Use PNG, JPG, WEBP, or SVG" }, { status: 400 });
  }

  const { data: proj } = await supabase
    .from("projects")
    .select("id, metadata")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!proj) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const prevMeta =
    proj.metadata && typeof proj.metadata === "object" && !Array.isArray(proj.metadata)
      ? (proj.metadata as Record<string, unknown>)
      : {};

  const admin = createSupabaseAdmin();
  const bucket = await ensurePublicBucket(admin, BUCKET);
  if (!bucket.ok) {
    return NextResponse.json({ error: bucket.error }, { status: 500 });
  }

  const ext =
    file.type === "image/svg+xml" ? "svg" : file.type === "image/webp" ? "webp" : file.type === "image/jpeg" ? "jpg" : "png";
  const objectPath = `${projectId}/icon.${ext}`;
  const buffer = new Uint8Array(await file.arrayBuffer());

  const { error: uploadErr } = await admin.storage.from(BUCKET).upload(objectPath, buffer, {
    contentType: file.type,
    upsert: true,
    cacheControl: "3600",
  });
  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(objectPath);
  const iconUrl = pub.publicUrl;

  const { error: upErr } = await supabase
    .from("projects")
    .update({
      icon_url: iconUrl,
      metadata: { ...prevMeta, icon_source: "upload" },
    } as never)
    .eq("id", projectId)
    .eq("owner_id", user.id);

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  notifyProjectCatalogUpdated(projectId);
  return NextResponse.json({ ok: true, iconUrl });
}
