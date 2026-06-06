import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  canTransition,
  isLifecycleStatus,
  readLifecycleFromMetadata,
  legacyProjectStatus,
  lifecyclePatch,
  type ProjectLifecycleStatus,
} from "@/lib/projects/project-lifecycle";
import {
  requireAuthUser,
  requireMutationProjectId,
  isNextResponse,
} from "@/lib/ids/api-mutation-guard";
import { logSecurityAudit } from "@/lib/security/audit-events";
import { findMissingRelativeImports } from "@/lib/build/import-graph";
import { filterRenderableBuildFiles } from "@/lib/build/generated-file-utils";
import { evaluatePostBuildContract } from "@/lib/build/post-build-contract";
import { computeCanonicalBuildState } from "@/lib/build/canonical-build-state";
import { isBuildJobEventsTableMissing, buildJobEventsSetupWarning } from "@/lib/build/build-events-schema-health";

export const dynamic = "force-dynamic";

function mapLifecycleToStatus(lifecycle: ProjectLifecycleStatus | undefined, buildStatus: string | null): string {
  if (buildStatus === "running" || buildStatus === "queued" || buildStatus === "starting") return "building";
  if (buildStatus === "failed") return "failed";
  if (buildStatus === "completed") return "ready";
  if (lifecycle === "published") return "published";
  if (lifecycle === "preview_ready" || lifecycle === "generated" || lifecycle === "publish_ready") return "ready";
  return "draft";
}

async function buildStatusPayload(projectId: string, ownerId: string) {
  const reader = createServiceRoleClient();
  if (!reader) {
    return NextResponse.json({ ok: false, error: "Service unavailable" }, { status: 503 });
  }

  const { data: project } = await reader
    .from("projects")
    .select("id, metadata, app_name, icon_url, status, build_status, preview_url, published_subdomain")
    .eq("id", projectId)
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (!project) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const meta =
    project.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
      ? (project.metadata as Record<string, unknown>)
      : {};
  const lifecycle = readLifecycleFromMetadata(project.metadata).lifecycle_status;

  const { data: jobs } = await reader
    .from("build_jobs")
    .select("id, status, error_message, created_at, updated_at, started_at, completed_at, meta")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1);

  const job = jobs?.[0] ?? null;
  let progress = 0;
  let currentStage: string | null = null;
  let currentFile: string | null = null;

  if (job) {
    const { data: events } = await reader
      .from("build_job_events")
      .select("type, title, file_path, progress_percent, created_at")
      .eq("job_id", job.id)
      .order("created_at", { ascending: false })
      .limit(1);

    const last = events?.[0];
    if (last?.progress_percent != null) progress = last.progress_percent;
    currentStage = last?.title ?? null;
    currentFile = last?.file_path ?? null;
    if (job.status === "completed") progress = 100;
    if ((job.status === "running" || job.status === "starting") && progress < 1) progress = 1;
  }

  const { data: files } = await reader
    .from("app_files")
    .select("path, content")
    .eq("project_id", projectId);

  const renderable = filterRenderableBuildFiles(
    (files ?? []).map((f) => ({ path: f.path, content: f.content ?? "" })),
  );
  const missingImports = findMissingRelativeImports(renderable);
  const contractEval = evaluatePostBuildContract({
    files: renderable,
    appName: project.app_name,
    hasIcon: Boolean(project.icon_url),
    routeMap: (meta.blueprint_routes as string[] | undefined) ?? null,
    tier: "standard",
    projectId,
    ownerId,
  });

  const buildStatus = job?.status ?? (meta.build_status as string | undefined) ?? null;
  const status = mapLifecycleToStatus(lifecycle, buildStatus);

  const canonical = computeCanonicalBuildState({
    metadata: meta,
    buildStatus: project.build_status ?? buildStatus,
    publishedSubdomain: project.published_subdomain,
    previewUrl: project.preview_url,
    files: renderable,
    projectId,
    ownerId,
    buildJobStatus: job?.status ?? null,
  });

  return NextResponse.json({
    ok: true,
    projectId,
    status,
    canonical,
    buildJobId: job?.id ?? null,
    progressPercent: progress,
    buildJob: job
      ? {
          id: job.id,
          status: job.status,
          progress,
          currentStage,
          currentFile,
          updatedAt: job.updated_at ?? job.created_at,
          error_message: job.error_message,
        }
      : null,
    files: {
      count: renderable.length,
      hasRenderableFiles: renderable.length > 0,
    },
    contract: {
      passed: contractEval.passed,
      failures: contractEval.failures.slice(0, 12),
    },
    setup_warning: isBuildJobEventsTableMissing() ? buildJobEventsSetupWarning() : undefined,
  });
}

/** GET — build status fallback for E2E and UI when event stream is delayed. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await ctx.params;
  const projectId = requireMutationProjectId(rawId);
  if (isNextResponse(projectId)) return projectId;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const auth = requireAuthUser(user);
  if (isNextResponse(auth)) return auth;

  return buildStatusPayload(projectId, auth.id);
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await ctx.params;
  const projectId = requireMutationProjectId(rawId);
  if (isNextResponse(projectId)) return projectId;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const auth = requireAuthUser(user);
  if (isNextResponse(auth)) return auth;

  let body: { status?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const nextStatus = body.status?.trim();
  if (!nextStatus || !isLifecycleStatus(nextStatus)) {
    return NextResponse.json(
      { error: "Invalid lifecycle status", code: "invalid_status" },
      { status: 400 },
    );
  }

  const writer = createServiceRoleClient() ?? supabase;
  const { data: project } = await writer
    .from("projects")
    .select("id, metadata, owner_id")
    .eq("id", projectId)
    .eq("owner_id", auth.id)
    .maybeSingle();

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const meta = readLifecycleFromMetadata(project.metadata);
  const current: ProjectLifecycleStatus = meta.lifecycle_status ?? "draft";

  if (!canTransition(current, nextStatus)) {
    return NextResponse.json(
      {
        error: `Cannot transition from ${current} to ${nextStatus}`,
        code: "invalid_transition",
        from: current,
        to: nextStatus,
      },
      { status: 400 },
    );
  }

  const prevMeta =
    project.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
      ? (project.metadata as Record<string, unknown>)
      : {};

  await writer
    .from("projects")
    .update({
      status: legacyProjectStatus(nextStatus),
      metadata: {
        ...prevMeta,
        ...lifecyclePatch(nextStatus, {
          status_change_reason: body.reason?.slice(0, 500) ?? null,
          status_changed_by: auth.id,
        }),
      },
    } as never)
    .eq("id", projectId)
    .eq("owner_id", auth.id);

  await logSecurityAudit({
    userId: auth.id,
    action: "lifecycle_override",
    projectId,
    metadata: { from: current, to: nextStatus, reason: body.reason ?? null },
    request,
  });

  return NextResponse.json({ ok: true, lifecycle_status: nextStatus, from: current });
}
