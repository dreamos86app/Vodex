import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { loadLatestPreviewDiagnostics } from "@/lib/imports/runtime-build-runner";
import type { PreviewRuntimeStatusPayload } from "@/lib/preview/preview-runtime-status";

const WORKER_STALE_MS = 5 * 60 * 1000;
const WORKER_CONNECTED_MS = 2 * 60 * 1000;

export async function loadPreviewRuntimeStatus(
  supabase: SupabaseClient,
  projectId: string,
  meta: Record<string, unknown>,
): Promise<PreviewRuntimeStatusPayload> {
  const admin = createSupabaseAdmin();
  const jobDiagnostics = admin ? await loadLatestPreviewDiagnostics(admin, projectId) : null;

  let jobRow: {
    id: string;
    status: string;
    created_at: string;
    artifact_path: string | null;
    locked_by: string | null;
    build_logs: string | null;
    logs: string | null;
  } | null = null;

  if (admin) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (admin as any)
      .from("preview_build_jobs")
      .select("id, status, created_at, artifact_path, locked_by, build_logs, logs")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    jobRow = data ?? null;
  }

  const diag =
    jobDiagnostics ??
    (meta.preview_diagnostics && typeof meta.preview_diagnostics === "object"
      ? (meta.preview_diagnostics as Record<string, unknown>)
      : null);

  const importMeta =
    meta.import && typeof meta.import === "object"
      ? (meta.import as Record<string, unknown>)
      : null;

  let workerConnected = false;
  if (admin) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: hb } = await (admin as any)
      .from("preview_worker_heartbeats")
      .select("last_seen_at")
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (hb?.last_seen_at) {
      workerConnected = Date.now() - new Date(hb.last_seen_at).getTime() < WORKER_CONNECTED_MS;
    }
  }

  const jobStatus = jobRow?.status ?? null;
  const queuedAt = jobRow?.created_at ? new Date(jobRow.created_at).getTime() : 0;
  const workerUnavailable =
    (jobStatus === "queued" && queuedAt > 0 && Date.now() - queuedAt > WORKER_STALE_MS) ||
    (jobStatus === "queued" && !workerConnected && queuedAt > 0 && Date.now() - queuedAt > 30_000);

  const previewRenderable = Boolean(meta.preview_renderable ?? diag?.previewRenderable);
  const previewHonest = Boolean(meta.preview_honest ?? previewRenderable);

  return {
    previewRenderable,
    previewHonest,
    previewStatus: String(diag?.previewStatus ?? meta.preview_status ?? "unknown"),
    jobStatus,
    jobId: jobRow?.id ?? (diag?.jobId as string | null) ?? null,
    framework: (meta.imported_framework as string) ?? (diag?.framework as string) ?? null,
    frameworkLabel:
      (diag?.frameworkLabel as string | undefined) ??
      (importMeta?.framework &&
      typeof importMeta.framework === "object" &&
      typeof (importMeta.framework as { label?: string }).label === "string"
        ? (importMeta.framework as { label: string }).label
        : null),
    artifactPath: jobRow?.artifact_path ?? (diag?.artifactPath as string | null) ?? null,
    blockedReason:
      (diag?.blockedReason as string | null) ?? (meta.preview_blocked_reason as string | null) ?? null,
    buildLogs:
      (typeof jobRow?.logs === "string" ? jobRow.logs : null) ??
      (typeof jobRow?.build_logs === "string" ? jobRow.build_logs : null) ??
      (typeof diag?.buildLogs === "string" ? diag.buildLogs : null),
    lockedBy: jobRow?.locked_by ?? null,
    workerUnavailable,
    workerConnected,
    workerUnavailableMessage: workerUnavailable
      ? workerConnected
        ? "Job is queued but not progressing — check worker logs."
        : "Preview worker not connected — run npm run preview-worker:dev or deploy the worker."
      : null,
    lastPreviewBuildAt:
      (typeof diag?.lastPreviewBuildAt === "string" ? diag.lastPreviewBuildAt : null) ??
      (typeof meta.last_preview_build_at === "string" ? meta.last_preview_build_at : null),
    entryFile:
      (Array.isArray(diag?.entryFiles) && diag.entryFiles[0]
        ? String(diag.entryFiles[0])
        : null) ??
      (typeof importMeta?.entry_file === "string" ? importMeta.entry_file : null),
    warnings: Array.isArray(diag?.warnings) ? diag.warnings.map(String) : [],
  };
}
