import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServerSessionUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const user = await getServerSessionUser();

  const { data: rows, error } = await supabase
    .from("templates")
    .select(
      "id, name, description, category, tags, preview_image_url, preview_url, uses_count, like_count, created_at, owner_id, creator_id",
    )
    .eq("is_official", false)
    .eq("visibility", "public")
    .order("uses_count", { ascending: false })
    .limit(48);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const creatorIds = [
    ...new Set(
      (rows ?? [])
        .map((r) => r.creator_id ?? r.owner_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const nameById = new Map<string, string>();
  if (creatorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, full_name")
      .in("id", creatorIds);
    for (const p of profiles ?? []) {
      const label = p.display_name?.trim() || p.full_name?.trim() || "Community builder";
      nameById.set(p.id, label);
    }
  }

  let likedIds = new Set<string>();
  if (user && rows?.length) {
    const { data: likes } = await supabase
      .from("template_likes")
      .select("template_id")
      .eq("user_id", user.id)
      .in(
        "template_id",
        rows.map((r) => r.id),
      );
    likedIds = new Set((likes ?? []).map((l) => l.template_id));
  }

  const items = (rows ?? []).map((row) => {
    const creatorId = row.creator_id ?? row.owner_id;
    const creatorName =
      (creatorId ? nameById.get(creatorId) : null) ?? "Community builder";
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      tags: row.tags ?? [],
      previewImageUrl: row.preview_image_url ?? row.preview_url,
      useCount: row.uses_count ?? 0,
      likeCount: row.like_count ?? 0,
      createdAt: row.created_at,
      creatorName,
      likedByMe: likedIds.has(row.id),
    };
  });

  return NextResponse.json({ items });
}
