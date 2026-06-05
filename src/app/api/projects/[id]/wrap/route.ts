import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const bodySchema = z.object({
  kind: z.enum(["web_zip", "web_deploy", "android_apk", "android_aab"]),
});

import { planAllowsAndroidWrap } from "@/lib/mobile/entitlements";
import { assertMobileReadinessGate } from "@/lib/mobile/readiness-gate";

function planAllowsAndroid(planId: string | null | undefined): boolean {
  return planAllowsAndroidWrap(planId);
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("id, owner_id")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: jobs, error } = await supabase
    .from("wrap_jobs")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: jobs ?? [] });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await ctx.params;
  const supabase = await createClient();
  const admin = createServiceRoleClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body: { kind } required" }, { status: 400 });
  }
  const { kind } = parsed.data;

  const { data: project } = await supabase
    .from("projects")
    .select("id, owner_id")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();

  const { data: prof } = await supabase.from("profiles").select("plan_id").eq("id", user.id).maybeSingle();
  const planId = prof?.plan_id ?? "free";

  if (!project?.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if ((kind === "android_apk" || kind === "android_aab") && !planAllowsAndroid(planId)) {
    return NextResponse.json(
      {
        error: "Android packaging requires Pro or higher.",
        locked: true,
        code: "plan_gate",
      },
      { status: 403 },
    );
  }

  if (kind === "android_apk" || kind === "android_aab") {
    const gate = await assertMobileReadinessGate(supabase, projectId, user.id);
    if (!gate.ok) {
      return NextResponse.json(
        {
          error: gate.state.message,
          code: gate.state.code,
          locked: true,
          criticalCount: gate.state.criticalCount,
        },
        { status: gate.status },
      );
    }
  }

  if (kind === "web_deploy") {
    const { data: job, error } = await supabase
      .from("wrap_jobs")
      .insert({
        user_id: user.id,
        project_id: projectId,
        kind,
        status: "requires_builder_config",
        error_message:
          "Web deploy is not wired to a hosting provider in this environment. Job is recorded; no deployment was started.",
        artifact_url: null,
        meta: {},
      } as never)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ job });
  }

  if (kind === "android_apk" || kind === "android_aab") {
    const { data: job, error } = await supabase
      .from("wrap_jobs")
      .insert({
        user_id: user.id,
        project_id: projectId,
        kind,
        status: "requires_builder_config",
        error_message:
          "APK/AAB builds need a remote builder (EAS, Gradle worker, or CI). Configure WRAP_ANDROID_WEBHOOK_URL or attach a builder service — job is queued for when that exists.",
        artifact_url: null,
        meta: { contract: "POST /v1/wrap-jobs/{id}/artifacts with signed upload" },
      } as never)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ job });
  }

  // web_zip — real export when app_files exist
  const writer = admin ?? supabase;
  const { data: files, error: fErr } = await writer
    .from("app_files")
    .select("path, content")
    .eq("project_id", projectId)
    .order("path", { ascending: true });

  if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 });
  if (!files?.length) {
    return NextResponse.json(
      {
        error: "No saved source files for this app yet. Run a build or import a ZIP first.",
        code: "no_files",
      },
      { status: 400 },
    );
  }

  const zip = new JSZip();
  for (const row of files) {
    zip.file(row.path, row.content);
  }
  const out = await zip.generateAsync({ type: "nodebuffer" });
  const path = `${user.id}/exports/${projectId}/${Date.now().toString(36)}.zip`;

  const { error: upErr } = await supabase.storage.from("media").upload(path, out, {
    contentType: "application/zip",
    upsert: false,
  });
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const { data: signed } = await supabase.storage.from("media").createSignedUrl(path, 60 * 60 * 24);
  const artifactUrl = signed?.signedUrl ?? null;

  const { data: job, error: jErr } = await supabase
    .from("wrap_jobs")
    .insert({
      user_id: user.id,
      project_id: projectId,
      kind: "web_zip",
      status: artifactUrl ? "succeeded" : "failed",
      error_message: artifactUrl ? null : "Could not sign export URL",
      artifact_url: artifactUrl,
      meta: { storage_path: path, file_count: files.length },
    })
    .select("*")
    .single();

  if (jErr) return NextResponse.json({ error: jErr.message }, { status: 500 });
  return NextResponse.json({ job, downloadUrl: artifactUrl });
}
