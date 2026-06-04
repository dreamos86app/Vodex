import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requireProjectId, jsonMissingId } from "@/lib/ids/required-ids";
import { loadPreviewRuntimeStatus } from "@/lib/preview/load-preview-runtime-status";
import { loadPreviewWorkerStatus } from "@/lib/preview/preview-worker-status";

export const dynamic = "force-dynamic";

function tailLogs(logs: string | null | undefined, max = 4000): string | null {
  if (!logs?.trim()) return null;
  const t = logs.trim();
  return t.length <= max ? t : t.slice(-max);
}

function mapState(jobStatus: string | null, previewStatus: string, renderable: boolean): string {
  if (renderable) return "ready";
  if (jobStatus === "running") return "running";
  if (jobStatus === "failed" || previewStatus === "failed") return "failed";
  if (jobStatus === "queued" || previewStatus === "queued") return "queued";
  return previewStatus || "unknown";
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await ctx.params;
  const projectId = requireProjectId(rawId);
  if (!projectId) return jsonMissingId("projectId", "Project id is required.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("metadata")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const meta =
    project.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
      ? (project.metadata as Record<string, unknown>)
      : {};

  const runtime = await loadPreviewRuntimeStatus(supabase, projectId, meta);
  const workers = await loadPreviewWorkerStatus();

  let workerId: string | null = runtime.lockedBy ?? null;
  if (!workerId && workers.workerIds.length === 1) workerId = workers.workerIds[0] ?? null;

  const admin = createSupabaseAdmin();
  let buildLogTail: string | null = tailLogs(runtime.buildLogs);
  if (admin && runtime.jobId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: job } = await (admin as any)
      .from("preview_build_jobs")
      .select("logs, build_logs, locked_by")
      .eq("id", runtime.jobId)
      .maybeSingle();
    if (job) {
      workerId = workerId ?? (typeof job.locked_by === "string" ? job.locked_by : null);
      buildLogTail = tailLogs(
        (typeof job.logs === "string" ? job.logs : null) ??
          (typeof job.build_logs === "string" ? job.build_logs : null) ??
          runtime.buildLogs,
      );
    }
  }

  const renderable = runtime.previewRenderable === true && runtime.previewHonest === true;

  return NextResponse.json({
    jobId: runtime.jobId,
    state: mapState(runtime.jobStatus, runtime.previewStatus, renderable),
    workerId,
    framework: runtime.framework,
    frameworkLabel: runtime.frameworkLabel,
    artifactReady: Boolean(runtime.artifactPath),
    renderable,
    blockedReason: runtime.blockedReason,
    buildLogTail,
    workerConnected: runtime.workerConnected,
    workerUnavailable: runtime.workerUnavailable,
    workerUnavailableMessage: runtime.workerUnavailableMessage,
    jobAgeLabel: runtime.jobAgeLabel,
    requiresDeployedWorker: runtime.requiresDeployedWorker,
    previewBuildMeta: runtime.previewBuildMeta,
    lockedBy: runtime.lockedBy,
  });
}
