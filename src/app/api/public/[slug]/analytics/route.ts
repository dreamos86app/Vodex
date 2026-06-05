import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse/i;
const rateBucket = new Map<string, { count: number; reset: number }>();
const RATE_LIMIT = 120;
const RATE_WINDOW_MS = 60_000;

type AnalyticsEvent = {
  event_type: string;
  path?: string;
  referrer?: string;
  country?: string;
  device?: string;
  browser?: string;
  session_id?: string;
  visitor_id?: string;
  message?: string;
  target?: string;
};

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function rateOk(key: string): boolean {
  const now = Date.now();
  const row = rateBucket.get(key);
  if (!row || now > row.reset) {
    rateBucket.set(key, { count: 1, reset: now + RATE_WINDOW_MS });
    return true;
  }
  row.count += 1;
  return row.count <= RATE_LIMIT;
}

async function resolvePublished(slug: string) {
  const admin = createServiceRoleClient();
  if (!admin) return null;
  const { data } = await admin
    .from("published_apps" as never)
    .select("id, project_id, owner_id, status")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!data) return null;
  const row = data as { id: string; project_id: string; owner_id: string };
  return { publishedAppId: row.id, projectId: row.project_id, ownerId: row.owner_id };
}

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await ctx.params;
  const slug = rawSlug?.trim().toLowerCase();
  if (!slug) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ua = req.headers.get("user-agent") ?? "";
  if (!ua || BOT_UA.test(ua)) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const ip = clientIp(req);
  if (!rateOk(`${slug}:${ip}`)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  let body: { events?: AnalyticsEvent[] };
  try {
    body = (await req.json()) as { events?: AnalyticsEvent[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const events = (body.events ?? []).slice(0, 25);
  if (!events.length) return NextResponse.json({ ok: true, inserted: 0 });

  const published = await resolvePublished(slug);
  if (!published) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ ok: true, inserted: 0, unavailable: true });

  const country = req.headers.get("x-vercel-ip-country") ?? req.headers.get("cf-ipcountry") ?? null;

  const rows = events
    .filter((e) => e.event_type && typeof e.event_type === "string")
    .map((e) => ({
      project_id: published.projectId,
      owner_id: published.ownerId,
      event_type: String(e.event_type).slice(0, 64),
      path: e.path ? String(e.path).slice(0, 500) : null,
      referrer: e.referrer ? String(e.referrer).slice(0, 500) : null,
      country: e.country ? String(e.country).slice(0, 64) : country,
      device: e.device ? String(e.device).slice(0, 64) : null,
      browser: e.browser ? String(e.browser).slice(0, 64) : null,
      session_id: e.session_id ? String(e.session_id).slice(0, 128) : null,
      meta: {
        visitor_id: e.visitor_id ? String(e.visitor_id).slice(0, 128) : null,
        published_app_id: published.publishedAppId,
        message: e.message ? String(e.message).slice(0, 200) : null,
        target: e.target ? String(e.target).slice(0, 500) : null,
      },
    }));

  const { error } = await admin.from("app_analytics_events" as never).insert(rows as never);
  if (error) {
    console.error("[public-analytics] insert failed:", error.message);
    return NextResponse.json({ ok: true, inserted: 0, unavailable: true });
  }

  return NextResponse.json({ ok: true, inserted: rows.length });
}
