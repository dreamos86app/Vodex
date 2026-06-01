import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { canViewBuildDiagnostics } from "@/lib/admin/can-view-build-diagnostics";
import type { BuildDiagnosticsPayload } from "@/lib/build/build-diagnostics";
import { mapLegacyPreviewErrorCode, isPreviewFailureCode } from "@/lib/preview/preview-failure-codes";
import type { BuildJobEventRow } from "@/lib/build/build-job-events";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; jobId: string }> },
) {
  const { id: projectId, jobId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  if (!canViewBuildDiagnostics(user.email)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const reader = createServiceRoleClient() ?? supabase;
  const { data: job } = await reader
    .from("build_jobs")
    .select("id, project_id, user_id, status, error_message, meta, created_at")
    .eq("id", jobId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (!job) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const { data: events } = await reader
    .from("build_job_events")
    .select("id, created_at, job_id, project_id, user_id, type, title, detail, file_path, progress_percent, metadata")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true })
    .limit(500);

  const { data: project } = await reader
    .from("projects")
    .select("id, metadata, app_name, owner_id, preview_url")
    .eq("id", projectId)
    .maybeSingle();

  const { data: files } = await reader
    .from("app_files")
    .select("path, content")
    .eq("project_id", projectId);

  const meta =
    job.meta && typeof job.meta === "object" && !Array.isArray(job.meta)
      ? (job.meta as Record<string, unknown>)
      : {};
  const projMeta =
    project?.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
      ? (project.metadata as Record<string, unknown>)
      : {};

  const rows = (events ?? []) as BuildJobEventRow[];
  const failed = rows.find((e) => e.type === "failed" || e.metadata?.preview_failed);
  const rawCode =
    (failed?.metadata?.preview_failure_code as string | undefined) ??
    (projMeta.preview_error_code as string | undefined) ??
    (failed?.metadata?.code as string | undefined);
  const failureCode = isPreviewFailureCode(rawCode ?? "")
    ? rawCode
    : mapLegacyPreviewErrorCode(rawCode);

  const pkg = files?.find((f) => f.path === "package.json");
  const root = files?.find((f) => f.path === "app/page.tsx" || f.path === "src/app/page.tsx");

  const diagnostics: BuildDiagnosticsPayload = {
    build_job_id: jobId,
    project_id: projectId,
    app_id: projectId,
    actor_user_id: job.user_id,
    workspace_id: (meta.workspace_id as string | undefined) ?? null,
    user_prompt: (meta.user_prompt as string | undefined) ?? (meta.prompt as string | undefined) ?? null,
    mode_at_submit: (meta.mode_at_submit as string | undefined) ?? null,
    model_used: (meta.primary_model_id as string | undefined) ?? (meta.model_id as string | undefined) ?? null,
    model_routing: (meta.model_routing as Record<string, unknown> | undefined) ?? null,
    billing_target: (meta.billing_target as string | undefined) ?? null,
    step_timeline: rows,
    file_events: rows.filter((e) => e.type === "writing_file" || e.type === "editing_file"),
    failed_step: failed?.title ?? null,
    failure_code: failureCode,
    failure_message: job.error_message ?? failed?.detail ?? null,
    stack_trace: (failed?.metadata?.stack_trace as string | undefined) ?? null,
    preview_url: project?.preview_url ?? null,
    preview_response: (projMeta.preview_html_snippet as string | undefined) ?? null,
    source_integrity_report: (projMeta.source_integrity_ok != null
      ? {
          source_integrity_ok: projMeta.source_integrity_ok,
          preview_renderable: projMeta.preview_renderable,
          blocked_reason: projMeta.blocked_reason,
        }
      : null) as Record<string, unknown> | null,
    generated_files: (files ?? []).map((f) => f.path),
    package_json_excerpt: pkg?.content?.slice(0, 4000) ?? null,
    root_page_excerpt: root?.content?.slice(0, 4000) ?? null,
    repair_attempts: Array.isArray(projMeta.repair_attempts) ? projMeta.repair_attempts : [],
    credit_events: Array.isArray(meta.credit_events) ? meta.credit_events : [],
    metadata: { job_status: job.status },
  };

  return NextResponse.json({ ok: true, diagnostics });
}
