import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isDreamosOwnerEmail } from "@/lib/admin-owner";
import { WORKER_CONNECTED_THRESHOLD_MS } from "@/lib/preview/preview-worker-status";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isDreamosOwnerEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ error: "Service role unavailable" }, { status: 503 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  const { data: hb } = await db
    .from("preview_worker_heartbeats")
    .select("last_seen_at")
    .order("last_seen_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const workerConnected = hb?.last_seen_at
    ? Date.now() - new Date(hb.last_seen_at).getTime() < WORKER_CONNECTED_THRESHOLD_MS
    : false;

  const { data: mobileJobs } = await db
    .from("mobile_build_jobs")
    .select("status")
    .order("created_at", { ascending: false })
    .limit(200);

  const mobileBuilds = { queued: 0, success: 0, failed: 0 };
  for (const j of mobileJobs ?? []) {
    const s = String(j.status);
    if (s === "queued" || s === "running") mobileBuilds.queued++;
    else if (s === "success") mobileBuilds.success++;
    else mobileBuilds.failed++;
  }

  const { data: zipJobs } = await db
    .from("preview_build_jobs")
    .select("status")
    .order("created_at", { ascending: false })
    .limit(200);

  const zip = { queued: 0, succeeded: 0, failed: 0 };
  for (const j of zipJobs ?? []) {
    const s = String(j.status);
    if (s === "queued" || s === "running") zip.queued++;
    else if (s === "succeeded") zip.succeeded++;
    else zip.failed++;
  }

  const { count: publishedApps } = await db
    .from("published_apps")
    .select("id", { count: "exact", head: true })
    .eq("status", "published");

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: recentBroadcasts } = await db
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .gte("created_at", weekAgo)
    .eq("category", "admin");

  const { count: storageErrors } = await db
    .from("analytics_events")
    .select("id", { count: "exact", head: true })
    .eq("event_type", "storage_error")
    .gte("created_at", weekAgo);

  const { data: statusRows } = await db
    .from("status_components")
    .select("key, current_status")
    .limit(50);

  let statusDegraded = 0;
  for (const row of statusRows ?? []) {
    const s = String((row as { current_status?: string }).current_status ?? "");
    if (s && s !== "operational" && s !== "unknown") statusDegraded++;
  }

  const { count: paddleEvents7d } = await db
    .from("payment_webhook_events")
    .select("id", { count: "exact", head: true })
    .eq("provider", "paddle")
    .gte("created_at", weekAgo);

  const { count: failedZip7d } = await db
    .from("preview_build_jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "failed")
    .gte("created_at", weekAgo);

  return NextResponse.json({
    previewWorker: { connected: workerConnected, lastSeen: hb?.last_seen_at ?? null },
    mobileBuilds,
    zipJobs: zip,
    publishing: { publishedApps: publishedApps ?? 0 },
    notifications: { recentBroadcasts: recentBroadcasts ?? 0 },
    billing: { paddleWebhooks7d: paddleEvents7d ?? 0 },
    storage: { errors7d: storageErrors ?? 0 },
    status: { degradedComponents: statusDegraded, totalComponents: statusRows?.length ?? 0 },
    diagnostics: { failedPreviewBuilds7d: failedZip7d ?? 0 },
    fetchedAt: new Date().toISOString(),
  });
}
