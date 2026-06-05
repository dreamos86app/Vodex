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

  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ events: [], totalClicks: 0 });

  const { data } = await admin
    .from("app_growth_events" as never)
    .select("channel, action, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(100);

  const events = (data ?? []) as Array<{ channel: string; action: string; created_at: string }>;
  const byChannel = new Map<string, number>();
  for (const e of events) {
    byChannel.set(e.channel, (byChannel.get(e.channel) ?? 0) + 1);
  }

  return NextResponse.json({
    totalClicks: events.filter((e) => e.action === "click").length,
    byChannel: [...byChannel.entries()].map(([channel, count]) => ({ channel, count })),
    events: events.slice(0, 20),
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
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

  const body = (await req.json()) as { channel?: string; action?: string };
  const channel = String(body.channel ?? "copy").slice(0, 32);
  const action = String(body.action ?? "click").slice(0, 32);

  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ ok: true, tracked: false });

  const { error } = await admin.from("app_growth_events" as never).insert({
    project_id: projectId,
    owner_id: user.id,
    channel,
    action,
    meta: {},
  } as never);

  if (error) {
    console.error("[growth] insert failed:", error.message);
    return NextResponse.json({ ok: true, tracked: false });
  }

  return NextResponse.json({ ok: true, tracked: true });
}
