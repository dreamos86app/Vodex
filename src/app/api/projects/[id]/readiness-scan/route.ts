import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { runAppReadinessEngine } from "@/lib/mobile/readiness-engine";
import { loadMobileRevenueCatPublicConfig } from "@/lib/mobile-billing/wrapper-config";
import { MOBILE_SECRET_KEYS } from "@/lib/mobile/secrets";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PHASES = [
  "reading_files",
  "checking_manifest",
  "checking_icons",
  "checking_splash",
  "checking_auth",
  "checking_privacy",
  "checking_permissions",
  "checking_play_store",
  "checking_app_store",
  "checking_revenuecat",
  "checking_sha",
  "checking_package_id",
  "checking_bundle",
] as const;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ scans: [], running: null });

  const { data } = await admin
    .from("app_readiness_scans" as never)
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(5);

  const running = (data ?? []).find(
    (r) => (r as { status?: string }).status === "queued" || (r as { status?: string }).status === "running",
  );

  return NextResponse.json({ scans: data ?? [], running: running ?? null });
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await ctx.params;
  const supabase = await createClient();
  const admin = createServiceRoleClient();
  const writer = admin ?? supabase;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!admin) return NextResponse.json({ error: "Unavailable" }, { status: 503 });

  const { data: running } = await admin
    .from("app_readiness_scans" as never)
    .select("id")
    .eq("project_id", projectId)
    .in("status", ["queued", "running"])
    .limit(1);
  if (running?.length) {
    return NextResponse.json(
      { error: "Scan already in progress", scanId: (running[0] as { id: string }).id },
      { status: 409 },
    );
  }

  const scanId = randomUUID();
  await admin.from("app_readiness_scans" as never).insert({
    id: scanId,
    project_id: projectId,
    owner_id: user.id,
    status: "running",
    progress: 2,
    phase: PHASES[0],
    started_at: new Date().toISOString(),
  } as never);

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, app_name, short_description, preview_url")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: config } = await supabase
    .from("mobile_app_configs" as never)
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  const { count: fileCount } = await supabase
    .from("app_files")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  const { data: files } = await supabase
    .from("app_files")
    .select("path, content")
    .eq("project_id", projectId)
    .limit(300);

  const { data: secrets } = await supabase
    .from("project_secrets")
    .select("key_name")
    .eq("project_id", projectId);

  const secretNames = new Set((secrets ?? []).map((s) => s.key_name as string));
  const cfg = (config ?? {}) as Record<string, unknown>;
  const rcPublic = await loadMobileRevenueCatPublicConfig(projectId);
  const revenueCatConfigured = rcPublic.enabled;
  const storeDraft =
    cfg.store_draft && typeof cfg.store_draft === "object"
      ? (cfg.store_draft as Record<string, unknown>)
      : {};
  const revenueCatOptedOut = storeDraft.revenuecat_not_used === true;

  try {
    for (let i = 0; i < PHASES.length; i++) {
      await admin
        .from("app_readiness_scans" as never)
        .update({
          phase: PHASES[i],
          progress: Math.round(((i + 1) / PHASES.length) * 85),
        } as never)
        .eq("id", scanId);
    }

    const report = await runAppReadinessEngine({
      projectId,
      supabase,
      config: cfg as never,
      fileCount: fileCount ?? 0,
      hasPreview: Boolean(project.preview_url),
      appName: (project as { app_name?: string }).app_name ?? project.name,
      description: (project as { short_description?: string }).short_description ?? null,
      files: files ?? [],
      androidCtx: {
        hasSigningSecret: secretNames.has(MOBILE_SECRET_KEYS.android_upload_key),
        hasPlayServiceAccount: secretNames.has(MOBILE_SECRET_KEYS.google_play_service_account),
        hasFirebase: secretNames.has(MOBILE_SECRET_KEYS.firebase_google_services),
        fileCount: fileCount ?? 0,
        previewUrl: project.preview_url,
        revenueCatConfigured,
      },
      iosCtx: {
        hasAscApiKey: secretNames.has(MOBILE_SECRET_KEYS.asc_api_private_key),
        hasApnsKey: secretNames.has(MOBILE_SECRET_KEYS.apns_key),
        hasSigningAssets: secretNames.has(MOBILE_SECRET_KEYS.android_signing_keystore),
        revenueCatConfigured,
      },
      revenueCatConfigured,
      revenueCatOptedOut,
    });

    const findings = [
      ...report.critical.map((f) => ({ id: f.id, label: f.label, detail: f.detail, severity: "critical" })),
      ...report.high.map((f) => ({ id: f.id, label: f.label, detail: f.detail, severity: "high" })),
      ...report.medium.map((f) => ({ id: f.id, label: f.label, detail: f.detail, severity: "medium" })),
      ...report.low.map((f) => ({ id: f.id, label: f.label, detail: f.detail, severity: "low" })),
    ];

    await admin
      .from("app_readiness_scans" as never)
      .update({
        status: "completed",
        progress: 100,
        phase: "complete",
        findings,
        summary: {
          score: report.score,
          filesScanned: fileCount ?? 0,
          issuesFound: findings.length,
          gatePassed: report.gatePassed,
        },
        completed_at: new Date().toISOString(),
      } as never)
      .eq("id", scanId);

    await writer.from("app_activity_events" as never).insert({
      project_id: projectId,
      owner_id: user.id,
      category: "mobile",
      action: "readiness_scan_completed",
      summary: `Mobile readiness scan completed — ${findings.length} issues`,
      meta: { scanId, issues: findings.length, score: report.score },
    } as never);

    return NextResponse.json({
      scanId,
      status: "completed",
      findings,
      summary: {
        filesScanned: fileCount ?? 0,
        issuesFound: findings.length,
        score: report.score,
        gatePassed: report.gatePassed,
      },
    });
  } catch (e) {
    await admin
      .from("app_readiness_scans" as never)
      .update({
        status: "failed",
        error_message: e instanceof Error ? e.message : "Scan failed",
        completed_at: new Date().toISOString(),
      } as never)
      .eq("id", scanId);
    return NextResponse.json({ error: "Scan failed", scanId }, { status: 500 });
  }
}
