import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Period = "24h" | "7d" | "30d" | "90d" | "realtime" | "custom";

function buildTimeseries(
  rows: Array<Record<string, unknown>>,
  period: Period,
): Array<{ date: string; views: number }> {
  const bucketMs =
    period === "realtime" || period === "24h"
      ? 60 * 60 * 1000
      : period === "7d"
        ? 24 * 60 * 60 * 1000
        : 7 * 24 * 60 * 60 * 1000;
  const m = new Map<string, number>();
  for (const r of rows) {
    if (r.event_type !== "page_view" && r.event_type !== "route_change") continue;
    const t = new Date(String(r.created_at ?? "")).getTime();
    if (Number.isNaN(t)) continue;
    const key = new Date(Math.floor(t / bucketMs) * bucketMs).toISOString().slice(0, 10);
    m.set(key, (m.get(key) ?? 0) + 1);
  }
  return [...m.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, views]) => ({ date, views }));
}

function periodStart(period: Period): string {
  const now = Date.now();
  const ms =
    period === "realtime" || period === "24h"
      ? 24 * 60 * 60 * 1000
      : period === "7d"
        ? 7 * 24 * 60 * 60 * 1000
        : period === "30d"
          ? 30 * 24 * 60 * 60 * 1000
          : 90 * 24 * 60 * 60 * 1000;
  return new Date(now - ms).toISOString();
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
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
  const period = (url.searchParams.get("period") ?? "7d") as Period;
  const since = periodStart(period);

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({
      period,
      pageViews: 0,
      uniqueVisitors: 0,
      sessions: 0,
      signups: 0,
      activeUsers: 0,
      conversionRate: 0,
      topPages: [],
      referrers: [],
      countries: [],
      devices: [],
      browsers: [],
      events: [],
      errors: [],
      revenue: null,
      realtimeVisitors: 0,
      empty: true,
    });
  }

  const { data: events, error } = await admin
    .from("app_analytics_events" as never)
    .select("event_type, path, referrer, country, device, browser, session_id, meta, created_at")
    .eq("project_id", projectId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) {
    console.error("[analytics] query failed:", error.message);
    return NextResponse.json({
      period,
      pageViews: 0,
      uniqueVisitors: 0,
      sessions: 0,
      signups: 0,
      activeUsers: 0,
      conversionRate: 0,
      topPages: [],
      referrers: [],
      countries: [],
      devices: [],
      browsers: [],
      events: [],
      errors: [],
      revenue: null,
      realtimeVisitors: 0,
      empty: true,
      unavailable: true,
    });
  }

  const rows = (events ?? []) as Array<Record<string, unknown>>;
  const pageViews = rows.filter((r) => r.event_type === "page_view").length;
  const visitors = new Set(
    rows.map((r) => (r.session_id as string) || (r.meta as { visitor_id?: string } | undefined)?.visitor_id).filter(Boolean),
  );
  const sessions = new Set(rows.map((r) => r.session_id).filter(Boolean));
  const signups = rows.filter((r) =>
    ["signup", "signup_success"].includes(String(r.event_type)),
  ).length;
  const logins = rows.filter((r) => String(r.event_type) === "login_success").length;
  const authViews = rows.filter((r) => String(r.event_type) === "auth_screen_view").length;

  const countBy = (key: string) => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const v = String(r[key] ?? "").trim();
      if (!v) continue;
      m.set(v, (m.get(v) ?? 0) + 1);
    }
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
  };

  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const realtimeVisitors = new Set(
    rows
      .filter((r) => String(r.created_at ?? "") >= fiveMinAgo)
      .map((r) => (r.session_id as string) || (r.meta as { visitor_id?: string } | undefined)?.visitor_id)
      .filter(Boolean),
  ).size;

  const { data: paymentRow } = await admin
    .from("app_payment_provider_connections" as never)
    .select("provider, status")
    .eq("project_id", projectId)
    .eq("status", "connected")
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    period,
    pageViews,
    uniqueVisitors: visitors.size,
    sessions: sessions.size,
    signups,
    logins,
    authViews,
    activeUsers: Math.max(visitors.size, logins),
    conversionRate: visitors.size ? Math.round((signups / visitors.size) * 1000) / 10 : 0,
    topPages: countBy("path"),
    referrers: countBy("referrer"),
    countries: countBy("country"),
    devices: countBy("device"),
    browsers: countBy("browser"),
    events: rows.slice(0, 50).map((r) => ({
      type: r.event_type,
      path: r.path,
      at: r.created_at,
    })),
    errors: rows
      .filter((r) => ["error", "error_event"].includes(String(r.event_type)))
      .slice(0, 20),
    timeseries: buildTimeseries(rows, period),
    revenue: paymentRow ? { connected: true, provider: (paymentRow as { provider?: string }).provider } : null,
    realtimeVisitors,
    empty: rows.length === 0,
  });
}
