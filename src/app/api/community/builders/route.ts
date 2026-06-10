import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { rankLabelForId } from "@/lib/community/user-ranks";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ builders: [] });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from("profiles")
    .select(
      "id, username, display_name, avatar_url, community_rank, follower_count, bio",
    )
    .neq("public_profile_enabled", false)
    .not("username", "is", null)
    .order("follower_count", { ascending: false })
    .limit(48);

  return NextResponse.json({
    builders: ((data ?? []) as Array<Record<string, unknown>>).map((p) => ({
      id: String(p.id),
      username: String(p.username),
      displayName: String(p.display_name ?? p.username),
      avatarUrl: (p.avatar_url as string | null) ?? null,
      rankLabel: rankLabelForId(String(p.community_rank ?? "")),
      followerCount: Number(p.follower_count ?? 0),
      bio: (p.bio as string | null) ?? null,
    })),
  });
}
