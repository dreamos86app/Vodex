import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

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
    .select("id")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({
      total: 0,
      activeThisWeek: 0,
      newSignups: 0,
      users: [],
      authMethods: [],
      empty: true,
    });
  }

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: profiles }, { data: signupEvents }] = await Promise.all([
    admin
      .from("app_user_profiles" as never)
      .select("id, email, display_name, avatar_url, auth_provider, auth_user_id, created_at, first_seen_at, last_seen_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("app_analytics_events" as never)
      .select("event_type, meta, created_at")
      .eq("project_id", projectId)
      .in("event_type", ["signup_success", "signup"])
      .gte("created_at", weekAgo)
      .limit(500),
  ]);

  const users = (profiles ?? []) as Array<Record<string, unknown>>;
  const activeThisWeek = users.filter(
    (u) => u.last_seen_at && String(u.last_seen_at) >= weekAgo,
  ).length;

  const authMethodCounts = new Map<string, number>();
  for (const u of users) {
    const p = String(u.auth_provider ?? "email");
    authMethodCounts.set(p, (authMethodCounts.get(p) ?? 0) + 1);
  }

  const signupFromAnalytics = (signupEvents ?? []).length;

  return NextResponse.json({
    total: users.length,
    activeThisWeek,
    newSignups: Math.max(signupFromAnalytics, users.filter((u) => String(u.created_at ?? "") >= weekAgo).length),
    users: users.map((u) => ({
      id: u.id,
      email: u.email ?? null,
      name: u.display_name ?? null,
      avatar: u.avatar_url ?? null,
      provider: u.auth_provider ?? "email",
      createdAt: u.created_at,
      lastSeen: u.last_seen_at ?? null,
    })),
    authMethods: [...authMethodCounts.entries()].map(([name, count]) => ({ name, count })),
    empty: users.length === 0 && signupFromAnalytics === 0,
  });
}
