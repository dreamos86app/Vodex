import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Period = "realtime" | "24h" | "7d" | "30d" | "90d" | "365d" | "custom";

function periodWindow(
  period: Period,
  fromParam?: string | null,
  toParam?: string | null,
): { since: string; until: string } {
  const now = Date.now();
  const until = toParam ? new Date(toParam).toISOString() : new Date(now).toISOString();
  if (period === "custom" && fromParam) {
    return { since: new Date(fromParam).toISOString(), until };
  }
  const ms =
    period === "realtime"
      ? 5 * 60 * 1000
      : period === "24h"
        ? 24 * 60 * 60 * 1000
        : period === "7d"
          ? 7 * 24 * 60 * 60 * 1000
          : period === "30d"
            ? 30 * 24 * 60 * 60 * 1000
            : period === "90d"
              ? 90 * 24 * 60 * 60 * 1000
              : period === "365d"
                ? 365 * 24 * 60 * 60 * 1000
                : 7 * 24 * 60 * 60 * 1000;
  return { since: new Date(now - ms).toISOString(), until };
}

function bucketKey(iso: string, period: Period): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  if (period === "realtime" || period === "24h") {
    const d = new Date(t);
    d.setMinutes(0, 0, 0);
    return d.toISOString();
  }
  if (period === "7d") {
    return new Date(t).toISOString().slice(0, 10);
  }
  return new Date(t).toISOString().slice(0, 10);
}

function formatBucketLabel(key: string, period: Period): string {
  const d = new Date(key);
  if (Number.isNaN(d.getTime())) return key;
  if (period === "realtime" || period === "24h") {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type TimeseriesPoint = { date: string; label: string; views: number };

function buildTimeseries(
  rows: Array<Record<string, unknown>>,
  period: Period,
  metric: "pageViews" | "sessions" | "signups" | "uniqueVisitors" = "pageViews",
): TimeseriesPoint[] {
  const counts = new Map<string, number>();
  const uniques = new Map<string, Set<string>>();

  for (const r of rows) {
    const created = String(r.created_at ?? "");
    const key = bucketKey(created, period);
    const type = String(r.event_type ?? "");
    const visitor =
      (r.session_id as string) ||
      (r.meta as { visitor_id?: string } | undefined)?.visitor_id ||
      "";

    if (metric === "pageViews") {
      if (type !== "page_view" && type !== "route_change") continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      continue;
    }
    if (metric === "signups") {
      if (!["signup", "signup_success"].includes(type)) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      continue;
    }
    if (metric === "sessions" || metric === "uniqueVisitors") {
      if (type !== "page_view" && type !== "route_change" && type !== "session_start") continue;
      if (!visitor) continue;
      const set = uniques.get(key) ?? new Set<string>();
      set.add(visitor);
      uniques.set(key, set);
    }
  }

  if (metric === "sessions" || metric === "uniqueVisitors") {
    return [...uniques.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, set]) => ({
        date,
        label: formatBucketLabel(date, period),
        views: set.size,
      }));
  }

  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, views]) => ({ date, label: formatBucketLabel(date, period), views }));
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
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const { since, until } = periodWindow(period, fromParam, toParam);

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
      timeseries: [],
    });
  }

  let query = admin
    .from("app_analytics_events" as never)
    .select("event_type, path, referrer, country, device, browser, session_id, meta, created_at")
    .eq("project_id", projectId)
    .gte("created_at", since)
    .lte("created_at", until)
    .order("created_at", { ascending: false })
    .limit(5000);

  const { data: events, error } = await query;

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
      timeseries: [],
    });
  }

  const rows = (events ?? []) as Array<Record<string, unknown>>;
  const pageViews = rows.filter((r) => r.event_type === "page_view").length;
  const visitors = new Set(
    rows
      .map(
        (r) =>
          (r.session_id as string) ||
          (r.meta as { visitor_id?: string } | undefined)?.visitor_id,
      )
      .filter(Boolean),
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

  const sessionEvents = new Map<string, Array<{ at: number; type: string }>>();
  for (const r of rows) {
    const sid = String(r.session_id ?? "");
    if (!sid) continue;
    const at = new Date(String(r.created_at ?? "")).getTime();
    if (Number.isNaN(at)) continue;
    const list = sessionEvents.get(sid) ?? [];
    list.push({ at, type: String(r.event_type) });
    sessionEvents.set(sid, list);
  }
  let bounceSessions = 0;
  let totalDurationSec = 0;
  let durationSessions = 0;
  for (const evs of sessionEvents.values()) {
    const pageViewsInSession = evs.filter((e) => e.type === "page_view").length;
    if (pageViewsInSession <= 1) bounceSessions += 1;
    if (evs.length >= 2) {
      const sorted = [...evs].sort((a, b) => a.at - b.at);
      const duration = (sorted[sorted.length - 1]!.at - sorted[0]!.at) / 1000;
      if (duration > 0 && duration < 60 * 60) {
        totalDurationSec += duration;
        durationSessions += 1;
      }
    }
  }
  const bounceRate = sessions.size ? Math.round((bounceSessions / sessions.size) * 1000) / 10 : 0;
  const avgSessionSeconds = durationSessions ? Math.round(totalDurationSec / durationSessions) : 0;

  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const realtimeVisitors = new Set(
    rows
      .filter((r) => String(r.created_at ?? "") >= fiveMinAgo)
      .map(
        (r) =>
          (r.session_id as string) ||
          (r.meta as { visitor_id?: string } | undefined)?.visitor_id,
      )
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
    since,
    until,
    pageViews,
    uniqueVisitors: visitors.size,
    sessions: sessions.size,
    signups,
    logins,
    authViews,
    activeUsers: Math.max(visitors.size, logins),
    conversionRate: visitors.size ? Math.round((signups / visitors.size) * 1000) / 10 : 0,
    bounceRate,
    avgSessionSeconds,
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
    timeseries: buildTimeseries(rows, period, "pageViews"),
    timeseriesByMetric: {
      pageViews: buildTimeseries(rows, period, "pageViews"),
      sessions: buildTimeseries(rows, period, "sessions"),
      signups: buildTimeseries(rows, period, "signups"),
      uniqueVisitors: buildTimeseries(rows, period, "uniqueVisitors"),
    },
    revenue: paymentRow
      ? { connected: true, provider: (paymentRow as { provider?: string }).provider }
      : null,
    realtimeVisitors,
    empty: rows.length === 0,
    realtimeNote:
      period === "realtime"
        ? "Live window: last 5 minutes including visitors active right now."
        : undefined,
  });
}
