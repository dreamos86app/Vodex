import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { canViewBuildDiagnostics } from "@/lib/admin/can-view-build-diagnostics";
import type { BuildDiagnosticsPayload } from "@/lib/build/build-diagnostics";
import { mapLegacyPreviewErrorCode, isPreviewFailureCode } from "@/lib/preview/preview-failure-codes";
import type { BuildJobEventRow } from "@/lib/build/build-job-events";
import { isThinGeneratedFile } from "@/lib/build/meaningful-file-guard";
import { findPrimaryAppPage } from "@/lib/build/source-integrity-validator";
import { evaluateSourceIntegrity } from "@/lib/build/source-integrity-validator";

export const dynamic = "force-dynamic";

function metaRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

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

  const reader = createServiceRoleClient() ?? supabase;

  if (!canViewBuildDiagnostics(user.email)) {
    const { data: owned } = await reader
      .from("projects")
      .select("id, owner_id")
      .eq("id", projectId)
      .maybeSingle();
    if (!owned || owned.owner_id !== user.id) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
  }

  const { data: job } = await reader
    .from("build_jobs")
    .select("id, project_id, user_id, status, error_message, meta, prompt, conversation_id, created_at")
    .eq("id", jobId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (!job) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const meta = metaRecord(job.meta);

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

  const conversationId =
    (typeof meta.conversation_id === "string" ? meta.conversation_id : null) ??
    job.conversation_id ??
    null;

  const operationId =
    (typeof meta.operation_id === "string" ? meta.operation_id : null) ??
    (typeof meta.generation_id === "string" ? meta.generation_id : null) ??
    null;

  let userPrompt: string | null =
    (typeof meta.user_prompt === "string" ? meta.user_prompt : null) ??
    (typeof meta.prompt === "string" ? meta.prompt : null) ??
    (typeof job.prompt === "string" ? job.prompt : null) ??
    null;

  const fieldNotes: Record<string, string> = {};

  if (!userPrompt && conversationId) {
    const { data: userMsg } = await reader
      .from("messages")
      .select("content, metadata, created_at")
      .eq("conversation_id", conversationId)
      .eq("role", "user")
      .order("created_at", { ascending: false })
      .limit(5);
    const linked = (userMsg ?? []).find((m) => {
      const mm = metaRecord(m.metadata);
      return !operationId || mm.operation_id === operationId;
    });
    const fallbackMsg = (userMsg ?? [])[0];
    const picked = linked ?? fallbackMsg;
    if (picked?.content) {
      userPrompt = String(picked.content);
    } else {
      fieldNotes.user_prompt =
        "prompt missing because no user message found for conversation_id on this job";
    }
  } else if (!userPrompt) {
    fieldNotes.user_prompt =
      "prompt missing because build job meta lacked user_prompt and conversation_id was not linked";
  }

  const modeAtSubmit =
    (typeof meta.mode_at_submit === "string" ? meta.mode_at_submit : null) ??
    (typeof meta.mode === "string" ? meta.mode : null) ??
    null;
  if (!modeAtSubmit) {
    fieldNotes.mode_at_submit = "mode missing because build_jobs.meta.mode_at_submit was not set at submit";
  }

  const projMeta = metaRecord(project?.metadata);

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
  const primaryPage = files?.length
    ? findPrimaryAppPage(
        files.map((f) => ({ path: f.path, content: f.content ?? "" })),
      )
    : undefined;
  const root =
    primaryPage ??
    files?.find((f) => f.path === "app/page.tsx" || f.path === "src/app/page.tsx");

  const thinFiles = (files ?? [])
    .filter((f) => f.content && isThinGeneratedFile({ path: f.path, content: f.content }))
    .map((f) => f.path)
    .slice(0, 40);

  const integrity = files?.length
    ? evaluateSourceIntegrity(files.map((f) => ({ path: f.path, content: f.content ?? "" })))
    : null;

  const jobCreatedAt = job.created_at ? new Date(job.created_at).getTime() : Date.now();
  const windowStart = new Date(jobCreatedAt - 2 * 60 * 60 * 1000).toISOString();

  let aiUsageRows: unknown[] = [];
  if (operationId) {
    const { data: usage } = await reader
      .from("ai_usage_logs")
      .select("*")
      .eq("operation_id", operationId)
      .order("created_at", { ascending: false })
      .limit(40);
    aiUsageRows = usage ?? [];
    if (!aiUsageRows.length) {
      const { data: prefixUsage } = await reader
        .from("ai_usage_logs")
        .select("*")
        .eq("project_id", projectId)
        .gte("created_at", windowStart)
        .order("created_at", { ascending: false })
        .limit(40);
      aiUsageRows = prefixUsage ?? [];
    }
  } else {
    const { data: usage } = await reader
      .from("ai_usage_logs")
      .select("*")
      .eq("project_id", projectId)
      .gte("created_at", windowStart)
      .order("created_at", { ascending: false })
      .limit(40);
    aiUsageRows = usage ?? [];
    fieldNotes.operation_id = "operation_id missing on job meta — showing recent project usage rows";
  }

  let creditEvents: unknown[] = Array.isArray(meta.credit_events) ? meta.credit_events : [];
  if (operationId) {
    const { data: ce } = await reader
      .from("credit_events")
      .select("*")
      .or(`idempotency_key.eq.${operationId},metadata->>operation_id.eq.${operationId}`)
      .order("created_at", { ascending: false })
      .limit(30);
    if (ce?.length) creditEvents = ce;
  }
  if (!creditEvents.length) {
    const { data: ceProj } = await reader
      .from("credit_events")
      .select("*")
      .eq("user_id", job.user_id)
      .gte("created_at", windowStart)
      .order("created_at", { ascending: false })
      .limit(30);
    if (ceProj?.length) creditEvents = ceProj;
  }

  const creditReserved =
    (failed?.metadata?.credits_reserved as number | undefined) ??
    (meta.credit_reserved as number | undefined) ??
    null;
  const creditCharged =
    (failed?.metadata?.credits_charged as number | undefined) ??
    (meta.credit_charged as number | undefined) ??
    null;
  const creditRefunded =
    (failed?.metadata?.credits_refunded as number | undefined) ??
    (meta.credit_refunded as number | undefined) ??
    null;
  const iconSkipped = projMeta.icon_generation_mode === "skipped_no_action_credits";
  const iconDepleted = projMeta.logo_generation_status === "insufficient_credits";

  let creditExplanation = "";
  if (creditReserved != null) {
    creditExplanation += `Build credits reserved: ${creditReserved}. `;
  }
  if (creditCharged != null) {
    creditExplanation += `Charged: ${creditCharged}. `;
  }
  if (creditRefunded != null && creditRefunded > 0) {
    creditExplanation += `Refunded: ${creditRefunded}. `;
  }
  if (creditCharged === 0 && creditRefunded && creditRefunded > 0) {
    creditExplanation +=
      "Net charge is 0 because the build failed or was refunded after reserve — model calls may still appear in AI usage logs. ";
  }
  if (iconDepleted || iconSkipped) {
    creditExplanation +=
      "Icon generation skipped: Action Credits depleted — deterministic symbolic fallback was used. ";
  }

  const dashboardPage = files?.find(
    (f) => f.path === "app/dashboard/page.tsx" || f.path === "src/app/dashboard/page.tsx",
  );
  const layoutFile = files?.find(
    (f) => f.path === "app/layout.tsx" || f.path === "src/app/layout.tsx",
  );

  const modelUsed =
    (typeof meta.primary_model_id === "string" ? meta.primary_model_id : null) ??
    (typeof meta.actual_model_id === "string" ? meta.actual_model_id : null) ??
    (typeof meta.model_id === "string" ? meta.model_id : null) ??
    null;

  const diagnostics: BuildDiagnosticsPayload = {
    build_job_id: jobId,
    project_id: projectId,
    app_id: projectId,
    actor_user_id: job.user_id,
    workspace_id: (meta.workspace_id as string | undefined) ?? null,
    operation_id: operationId,
    user_prompt: userPrompt,
    mode_at_submit: modeAtSubmit,
    model_used: modelUsed,
    model_routing: (meta.model_routing as Record<string, unknown> | undefined) ?? {
      user_selected_model_label: meta.user_selected_model_label,
      actual_provider: meta.actual_provider,
      actual_model_id: meta.actual_model_id,
    },
    billing_target: (meta.billing_target as string | undefined) ?? null,
    step_timeline: rows,
    file_events: rows.filter((e) => e.type === "writing_file" || e.type === "editing_file"),
    failed_step: failed?.title ?? null,
    failure_code: failureCode,
    failure_message: job.error_message ?? failed?.detail ?? null,
    stack_trace: (failed?.metadata?.stack_trace as string | undefined) ?? null,
    preview_url: project?.preview_url ?? null,
    preview_response: (projMeta.preview_html_snippet as string | undefined) ?? null,
    source_integrity_report: integrity
      ? ({
          ...integrity,
          source_integrity_ok: projMeta.source_integrity_ok ?? integrity.sourceIntegrityOk,
          preview_renderable: projMeta.preview_renderable ?? integrity.previewRenderable,
          blocked_reason: projMeta.blocked_reason ?? integrity.blockedReason,
        } as Record<string, unknown>)
      : (projMeta.source_integrity_ok != null
          ? {
              source_integrity_ok: projMeta.source_integrity_ok,
              preview_renderable: projMeta.preview_renderable,
              blocked_reason: projMeta.blocked_reason,
            }
          : null) as Record<string, unknown> | null,
    generated_files: (files ?? []).map((f) => f.path),
    thin_or_missing_files: thinFiles,
    package_json_excerpt: pkg?.content?.slice(0, 4000) ?? null,
    root_page_excerpt: root?.content?.slice(0, 4000) ?? null,
    dashboard_page_excerpt: dashboardPage?.content?.slice(0, 4000) ?? null,
    layout_excerpt: layoutFile?.content?.slice(0, 2000) ?? null,
    preview_diagnostics: {
      preview_renderer_source: projMeta.preview_renderer_source ?? null,
      preview_primary_file: projMeta.preview_primary_file ?? root?.path ?? null,
      preview_html_snippet: projMeta.preview_html_snippet ?? null,
    },
    repair_attempts: Array.isArray(projMeta.repair_attempts) ? projMeta.repair_attempts : [],
    credit_events: creditEvents,
    ai_usage_rows: aiUsageRows,
    credit_explanation: creditExplanation.trim() || null,
    field_missing_notes: Object.keys(fieldNotes).length ? fieldNotes : undefined,
    credit_accounting: {
      credit_reserved: creditReserved,
      credit_charged: creditCharged,
      credit_refunded: creditRefunded,
      icon_credit_skipped: iconSkipped,
      icon_credit_depleted: iconDepleted,
      explain_zero_charge:
        creditCharged === 0 && (creditRefunded ?? 0) > 0
          ? "reserved_then_refunded"
          : creditCharged === 0
            ? "no_charge_recorded"
            : null,
    },
    metadata: {
      job_status: job.status,
      conversation_id: conversationId,
      route: "/api/projects/[id]/build-jobs/[jobId]/diagnostics",
      feature_expansion_count: meta.feature_expansion_count,
      expanded_prompt_excerpt:
        typeof meta.expanded_prompt === "string" ? meta.expanded_prompt.slice(0, 500) : null,
    },
  };

  return NextResponse.json({ ok: true, diagnostics });
}
