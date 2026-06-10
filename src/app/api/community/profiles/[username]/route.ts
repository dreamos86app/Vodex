import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { rankLabelForId, resolveUserRank } from "@/lib/community/user-ranks";
import { buildInternalPreviewHtmlUrl } from "@/lib/preview/internal-preview-url";

export const dynamic = "force-dynamic";

type PublicProfileRow = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  community_rank: string | null;
  follower_count: number | null;
  profile_visit_count: number | null;
  profile_visits_30d: number | null;
  public_profile_enabled: boolean | null;
  show_apps_on_profile: boolean | null;
  show_follower_count: boolean | null;
  allow_follows: boolean | null;
  created_at: string;
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ username: string }> },
) {
  const { username } = await ctx.params;
  const slug = username.trim().toLowerCase();
  if (!slug) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ error: "Unavailable" }, { status: 503 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  const { data: profile } = (await db
    .from("profiles")
    .select(
      "id, username, display_name, avatar_url, bio, community_rank, follower_count, profile_visit_count, profile_visits_30d, public_profile_enabled, show_apps_on_profile, show_follower_count, allow_follows, created_at",
    )
    .ilike("username", slug)
    .maybeSingle()) as { data: PublicProfileRow | null };

  if (!profile) {
    return NextResponse.json({ error: "Profile not found", visibility: "missing" }, { status: 404 });
  }

  if (profile.public_profile_enabled === false) {
    const isOwner = user?.id === profile.id;
    return NextResponse.json({
      visibility: "private",
      isOwner,
      username: profile.username,
      displayName: profile.display_name ?? profile.username,
      avatarUrl: isOwner ? profile.avatar_url : null,
      message: isOwner
        ? "Your profile is private. Enable it in Settings to share with the community."
        : "This builder keeps their profile private.",
    });
  }

  if (user && user.id !== profile.id) {
    await db.from("profile_visits").insert({
      profile_user_id: profile.id,
      visitor_id: user.id,
    });
    await db
      .from("profiles")
      .update({
        profile_visit_count: (profile.profile_visit_count ?? 0) + 1,
      })
      .eq("id", profile.id);
  }

  let following = false;
  if (user) {
    const { data: follow } = await db
      .from("user_follows")
      .select("follower_id")
      .eq("follower_id", user.id)
      .eq("following_id", profile.id)
      .maybeSingle();
    following = Boolean(follow);
  }

  const { count: postCount } = await db
    .from("discussions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .eq("is_deleted", false);

  const { count: publishedCount } = await db
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", profile.id)
    .eq("is_public", true);

  const rank = resolveUserRank({
    appsCreated: 0,
    publishedApps: publishedCount ?? 0,
    communityPosts: postCount ?? 0,
    commentsReplies: 0,
    receivedLikes: 0,
    followers: profile.follower_count ?? 0,
    profileVisits: profile.profile_visit_count ?? 0,
  });

  let apps: Array<{ id: string; name: string; previewUrl: string }> = [];
  const showApps = profile.show_apps_on_profile !== false;
  if (showApps) {
    const { data: rows } = await db
      .from("projects")
      .select("id, name, app_name, is_public, metadata")
      .eq("owner_id", profile.id)
      .or("is_public.eq.true,metadata->>community_listed.eq.true")
      .order("updated_at", { ascending: false })
      .limit(12);
    apps = (rows ?? []).map((p: { id: string; name: string; app_name: string | null }) => ({
      id: p.id,
      name: p.app_name ?? p.name,
      previewUrl: buildInternalPreviewHtmlUrl({ projectId: p.id }),
    }));
  }

  return NextResponse.json({
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name ?? profile.username,
    avatarUrl: profile.avatar_url,
    bio: profile.bio,
    rank: rank.id,
    rankLabel: rankLabelForId(profile.community_rank ?? rank.id),
    followerCount: profile.show_follower_count ? profile.follower_count ?? 0 : null,
    profileVisitCount: profile.profile_visit_count ?? 0,
    profileVisits30d: profile.profile_visits_30d ?? 0,
    joinedAt: profile.created_at,
    allowFollows: profile.allow_follows,
    following,
    isOwner: user?.id === profile.id,
    apps,
  });
}
