import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizeGroupCategories } from "@/lib/community/group-categories";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    name?: string;
    description?: string | null;
    categories?: string[];
    category?: string;
    bannerColor?: string;
    iconUrl?: string | null;
    slug?: string;
  };

  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const categories = normalizeGroupCategories(
    body.categories?.length ? body.categories : body.category ? [body.category] : ["General"],
  );
  const slug =
    body.slug?.trim() ||
    `${name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 60)}-${Date.now().toString(36)}`;

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }

  const { data: group, error } = await admin
    .from("groups")
    .insert({
      creator_id: user.id,
      name,
      slug,
      description: body.description?.trim() || null,
      category: categories[0],
      categories,
      banner_color: body.bannerColor ?? "#4f7cff",
      icon_url: body.iconUrl ?? null,
      is_public: true,
      is_featured: false,
      member_count: 1,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await admin.from("group_members").insert({
    group_id: group.id,
    user_id: user.id,
    role: "admin",
  });

  return NextResponse.json({ ok: true, group });
}
