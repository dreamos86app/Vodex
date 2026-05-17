import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_MIME = [
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml",
  "application/pdf", "text/plain", "video/mp4", "video/webm",
];
const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: assets, error } = await supabase
    .from("media_assets")
    .select(
      "id, created_at, filename, public_url, mime_type, size_bytes, asset_type, project_id",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    // Graceful: table or bucket not yet provisioned on this instance.
    console.warn("[api/media] GET failed:", error.message);
    return NextResponse.json({ assets: [] });
  }
  return NextResponse.json({ assets: assets ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const projectId = (formData.get("project_id") as string | null) ?? undefined;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "File exceeds 50 MB limit" }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "bin";
  const storagePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("media")
    .upload(storagePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(storagePath);

  const assetType = file.type.startsWith("image/")
    ? "image"
    : file.type.startsWith("video/")
    ? "video"
    : "document";

  const { data: asset, error: dbError } = await supabase
    .from("media_assets")
    .insert({
      user_id: user.id,
      project_id: projectId ?? null,
      filename: file.name,
      storage_path: storagePath,
      public_url: publicUrl,
      mime_type: file.type,
      size_bytes: file.size,
      asset_type: assetType,
    })
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  // Track upload in analytics
  await supabase.from("analytics_events").insert({
    user_id: user.id,
    event_type: "media_upload",
    properties: { mime_type: file.type, size_bytes: file.size },
  });

  return NextResponse.json({ asset }, { status: 201 });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "No id provided" }, { status: 400 });

  const { data: asset } = await supabase
    .from("media_assets")
    .select("storage_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  // Delete from Storage
  await supabase.storage.from("media").remove([asset.storage_path]);

  // Delete from DB
  await supabase.from("media_assets").delete().eq("id", id);

  return NextResponse.json({ success: true });
}
