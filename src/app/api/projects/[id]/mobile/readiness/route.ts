import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { loadMobileRevenueCatPublicConfig } from "@/lib/mobile-billing/wrapper-config";
import { runAppReadinessEngine } from "@/lib/mobile/readiness-engine";
import {
  readinessReportToHtml,
  readinessReportToJson,
  readinessReportToPdfBytes,
} from "@/lib/mobile/readiness-report-export";
import { persistMobileGateMeta } from "@/lib/mobile/readiness-gate";
import { MOBILE_SECRET_KEYS } from "@/lib/mobile/secrets";
import { quoteMobileAction } from "@/lib/mobile/action-pricing";

const bodySchema = z.object({
  revenuecat_opt_out: z.boolean().optional(),
});

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const format = url.searchParams.get("format");

  const { data: config } = await supabase
    .from("mobile_app_configs" as never)
    .select("meta, app_name")
    .eq("project_id", projectId)
    .maybeSingle();

  const meta =
    config &&
    (config as { meta?: unknown }).meta &&
    typeof (config as { meta?: unknown }).meta === "object"
      ? ((config as { meta?: unknown }).meta as Record<string, unknown>)
      : {};
  const report = meta.last_readiness_engine_report;
  if (!report) {
    return NextResponse.json({ error: "No report — run POST scan first" }, { status: 404 });
  }

  const appName = String(
    (config as { app_name?: string } | null)?.app_name ?? "App",
  );

  if (format === "json") {
    return new NextResponse(readinessReportToJson(report as never), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="readiness-${projectId}.json"`,
      },
    });
  }
  if (format === "html") {
    return new NextResponse(readinessReportToHtml(report as never, appName), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="readiness-${projectId}.html"`,
      },
    });
  }
  if (format === "pdf") {
    const pdf = readinessReportToPdfBytes(report as never, appName);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="readiness-${projectId}.pdf"`,
      },
    });
  }

  const { data: checks } = await supabase
    .from("mobile_readiness_checks" as never)
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(8);

  return NextResponse.json({ checks: checks ?? [], quote: quoteMobileAction("mobile_readiness_scan") });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await ctx.params;
  const supabase = await createClient();
  const admin = createServiceRoleClient();
  const writer = admin ?? supabase;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, app_name, short_description, preview_url, icon_url, owner_id")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

  if (parsed.success && parsed.data.revenuecat_opt_out) {
    const store_draft = {
      ...(typeof cfg.store_draft === "object" && cfg.store_draft ? cfg.store_draft : {}),
      revenuecat_not_used: true,
    };
    await writer
      .from("mobile_app_configs" as never)
      .upsert({ project_id: projectId, owner_id: user.id, store_draft } as never, {
        onConflict: "project_id",
      });
    cfg.store_draft = store_draft;
  }

  const storeDraft =
    cfg.store_draft && typeof cfg.store_draft === "object"
      ? (cfg.store_draft as Record<string, unknown>)
      : {};
  const revenueCatOptedOut = storeDraft.revenuecat_not_used === true;

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

  await persistMobileGateMeta(writer, projectId, user.id, {
    passed: report.gatePassed,
    criticalCount: report.critical.length,
    blockerCount: report.critical.length,
  });

  const prevMeta =
    cfg.meta && typeof cfg.meta === "object" && !Array.isArray(cfg.meta)
      ? (cfg.meta as Record<string, unknown>)
      : {};

  await writer.from("mobile_app_configs" as never).upsert(
    {
      project_id: projectId,
      owner_id: user.id,
      readiness_android: report.eligibility.scores.android,
      readiness_ios: report.eligibility.scores.ios,
      readiness_store: report.eligibility.scores.store,
      readiness_state: {
        score: report.score,
        gatePassed: report.gatePassed,
        critical: report.critical.length,
        high: report.high.length,
        scannedAt: report.generatedAt,
      },
      sha_keys: {
        sha256: storeDraft.play_sha256_entries ?? storeDraft.play_sha256_fingerprints ?? [],
        sha1: storeDraft.play_sha1_entries ?? storeDraft.play_sha1_fingerprints ?? [],
      },
      revenuecat: {
        status: report.revenueCat.status,
        optedOut: revenueCatOptedOut,
        score: report.revenueCat.score,
      },
      splash: {
        url: (cfg.splash_url as string | null) ?? null,
      },
      play_store: storeDraft.store_onboarding_progress
        ? { google_play: (storeDraft.store_onboarding_progress as Record<string, unknown>).google_play }
        : {},
      app_store: storeDraft.store_onboarding_progress
        ? { apple_app_store: (storeDraft.store_onboarding_progress as Record<string, unknown>).apple_app_store }
        : {},
      meta: {
        ...prevMeta,
        readiness_gate_passed_at: report.gatePassed ? new Date().toISOString() : null,
        last_readiness_blocker_count: report.critical.length,
        last_eligibility_critical_count: report.critical.length,
        last_readiness_engine_report: report,
      },
    } as never,
    { onConflict: "project_id" },
  );

  return NextResponse.json({
    report,
    reportJson: readinessReportToJson(report),
    score: report.score,
    gatePassed: report.gatePassed,
    critical: report.critical,
    high: report.high,
    medium: report.medium,
    low: report.low,
    revenueCat: report.revenueCat,
    blockers: report.critical.map((b) => b.label),
    actionCreditsCharged: 0,
    quote: quoteMobileAction("mobile_readiness_scan"),
    downloads: {
      json: `/api/projects/${projectId}/mobile/readiness?format=json`,
      html: `/api/projects/${projectId}/mobile/readiness?format=html`,
      pdf: `/api/projects/${projectId}/mobile/readiness?format=pdf`,
    },
  });
}
