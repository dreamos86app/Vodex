import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { loadLatestPreviewDiagnostics } from "@/lib/imports/runtime-build-runner";
import {
  formatJobAge,
  type PackageRepairDiagnosticsPayload,
  type PreviewBuildMeta,
  type PreviewRuntimeStatusPayload,
} from "@/lib/preview/preview-runtime-status";
import { isServerlessHost } from "@/lib/imports/preview-build-queue";
import { WORKER_CONNECTED_THRESHOLD_MS } from "@/lib/preview/preview-worker-status";
import { loadZipPreviewBillingForProject } from "@/lib/imports/zip-preview-billing";
import { derivePreviewFailure } from "@/lib/preview/derive-preview-failure";

const WORKER_STALE_MS = 5 * 60 * 1000;
const WORKER_QUEUE_GRACE_MS = 8_000;

function previewNotStartedFromMeta(meta: Record<string, unknown>): boolean {
  return (
    meta.preview_ready !== true &&
    meta.preview_renderable !== true &&
    (meta.preview_status == null ||
      meta.preview_status === "not_started" ||
      meta.preview_status === "unknown")
  );
}

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
    preview_renderable: boolean | null;
  } | null = null;

  if (admin) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (admin as any)
      .from("preview_build_jobs")
      .select("id, status, created_at, artifact_path, locked_by, build_logs, logs, preview_renderable")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    jobRow = data ?? null;
  }

  const sessionId =
    typeof meta.last_preview_session_id === "string"
      ? meta.last_preview_session_id
      : typeof meta.preview_session_id === "string"
        ? meta.preview_session_id
        : null;

  let sessionRow: {
    id: string;
    status: string;
    snapshot_id: string | null;
    provider_level: string | null;
    error: string | null;
    created_at: string;
  } | null = null;

  if (admin && sessionId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (admin as any)
      .from("preview_sessions")
      .select("id, status, snapshot_id, provider_level, error, created_at")
      .eq("id", sessionId)
      .eq("project_id", projectId)
      .maybeSingle();
    sessionRow = data ?? null;
  }

  if (admin && !sessionRow) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (admin as any)
      .from("preview_sessions")
      .select("id, status, snapshot_id, provider_level, error, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    sessionRow = data ?? null;
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
      workerConnected =
        Date.now() - new Date(hb.last_seen_at).getTime() < WORKER_CONNECTED_THRESHOLD_MS;
    }
  }

  const jobStatus = jobRow?.status ?? null;
  const jobCreatedAt = jobRow?.created_at ?? null;
  const queuedAt = jobCreatedAt ? new Date(jobCreatedAt).getTime() : 0;
  const jobAgeSeconds =
    queuedAt > 0 ? Math.max(0, Math.floor((Date.now() - queuedAt) / 1000)) : null;
  const requiresDeployedWorker = isServerlessHost();
  const queueStale =
    jobStatus === "queued" && queuedAt > 0 && Date.now() - queuedAt > WORKER_STALE_MS;
  const queueNoWorker =
    jobStatus === "queued" &&
    !workerConnected &&
    queuedAt > 0 &&
    Date.now() - queuedAt > WORKER_QUEUE_GRACE_MS;
  const workerUnavailable = queueStale || queueNoWorker;

  const jobSucceededRenderable =
    jobRow?.status === "succeeded" && jobRow.preview_renderable === true;
  const sessionReady = sessionRow?.status === "ready";
  const sessionRenderable =
    sessionReady &&
    (meta.preview_ready === true || meta.preview_honest === true || meta.preview_renderable === true);
  const previewRenderable = Boolean(
    meta.preview_renderable === true ||
      diag?.previewRenderable === true ||
      jobSucceededRenderable ||
      sessionRenderable ||
      (meta.preview_ready === true && meta.preview_honest === true && Boolean(sessionId)),
  );
  const previewHonest = Boolean(
    meta.preview_honest === true ||
      (previewRenderable &&
        meta.preview_honest !== false &&
        (jobSucceededRenderable || sessionReady || meta.preview_ready === true)),
  );

  const previewSource: PreviewRuntimeStatusPayload["previewSource"] = jobRow
    ? "worker_job"
    : sessionRow
      ? "preview_session"
      : meta.preview_renderable === true &&
          (meta.preview_status === "ready" || meta.preview_honest === true)
        ? "metadata"
        : "none";

  const resolvedJobId = jobRow?.id ?? sessionRow?.id ?? null;
  const resolvedJobStatus =
    jobRow?.status ??
    (sessionRow?.status === "ready"
      ? "succeeded"
      : sessionRow?.status === "building"
        ? "running"
        : sessionRow?.status ?? null);
  const resolvedPreviewStatus = String(
    diag?.previewStatus ??
      meta.preview_status ??
      (sessionRow?.status === "ready"
        ? "ready"
        : sessionRow?.status === "building"
          ? "running"
          : sessionRow?.status === "failed"
            ? "failed"
            : jobRow?.status === "succeeded"
              ? "ready"
              : jobRow?.status ??
                (sessionRow
                  ? sessionRow.status
                  : meta.preview_status === "not_started"
                    ? "not_started"
                    : previewNotStartedFromMeta(meta)
                      ? "not_started"
                      : "unknown")),
  );
  const resolvedFramework =
    (meta.imported_framework as string) ??
    (typeof meta.preview_framework === "string" ? meta.preview_framework : null) ??
    (diag?.framework as string) ??
    (sessionRow?.provider_level ? `session:${sessionRow.provider_level}` : null);
  const resolvedArtifactPath =
    jobRow?.artifact_path ??
    (typeof meta.preview_artifact_path === "string" ? meta.preview_artifact_path : null) ??
    (diag?.artifactPath as string | null) ??
    (sessionRow?.snapshot_id ? `session:${sessionRow.snapshot_id}` : null);

  const diagRecord = diag as Record<string, unknown> | null;
  const diagBilling =
    diagRecord?.previewBilling && typeof diagRecord.previewBilling === "object"
      ? (diagRecord.previewBilling as {
          estimated_action_credits?: number;
          charged_action_credits?: number | null;
          charge_status?: string;
        })
      : null;
  const billingFromDiag =
    diagBilling ??
    (diagRecord?.estimated_action_credits != null
      ? {
          estimated_action_credits: Number(diagRecord.estimated_action_credits),
          charged_action_credits:
            diagRecord.charged_action_credits != null
              ? Number(diagRecord.charged_action_credits)
              : null,
          charge_status: String(diagRecord.charge_status ?? "none"),
        }
      : null);
  const billing =
    billingFromDiag ??
    (await loadZipPreviewBillingForProject(projectId).catch(() => null));

  const chargeStatus =
    billing?.charge_status === "pending" ||
    billing?.charge_status === "charged" ||
    billing?.charge_status === "refunded" ||
    billing?.charge_status === "cancelled" ||
    billing?.charge_status === "none"
      ? billing.charge_status
      : null;

  const payload: PreviewRuntimeStatusPayload = {
    previewRenderable,
    previewHonest,
    previewStatus: resolvedPreviewStatus,
    jobStatus: resolvedJobStatus,
    jobId: resolvedJobId,
    framework: resolvedFramework,
    frameworkLabel:
      (diag?.frameworkLabel as string | undefined) ??
      (importMeta?.framework &&
      typeof importMeta.framework === "object" &&
      typeof (importMeta.framework as { label?: string }).label === "string"
        ? (importMeta.framework as { label: string }).label
        : sessionRow?.provider_level === "in_app_sandbox"
          ? "Vodex in-app preview"
          : sessionRow?.provider_level
            ? String(sessionRow.provider_level)
            : null),
    artifactPath: resolvedArtifactPath,
    previewSource,
    blockedReason:
      (diag?.blockedReason as string | null) ?? (meta.preview_blocked_reason as string | null) ?? null,
    errorCode: (() => {
      const d = diag as Record<string, unknown> | null;
      const fromDiag = d?.errorCode;
      if (typeof fromDiag === "string") return fromDiag;
      const bm =
        diag && typeof diag === "object" && "previewBuildMeta" in diag
          ? (diag as Record<string, unknown>).previewBuildMeta
          : null;
      if (bm && typeof bm === "object" && typeof (bm as { errorCode?: string }).errorCode === "string") {
        return (bm as { errorCode: string }).errorCode;
      }
      return null;
    })(),
    userMessage: (() => {
      const d = diag as Record<string, unknown> | null;
      const fromDiag = d?.userMessage;
      if (typeof fromDiag === "string") return fromDiag;
      const bm =
        diag && typeof diag === "object" && "previewBuildMeta" in diag
          ? (diag as Record<string, unknown>).previewBuildMeta
          : null;
      if (bm && typeof bm === "object" && typeof (bm as { userMessage?: string }).userMessage === "string") {
        return (bm as { userMessage: string }).userMessage;
      }
      return null;
    })(),
    buildLogs:
      (typeof jobRow?.logs === "string" ? jobRow.logs : null) ??
      (typeof jobRow?.build_logs === "string" ? jobRow.build_logs : null) ??
      (typeof diag?.buildLogs === "string" ? diag.buildLogs : null),
    lockedBy: jobRow?.locked_by ?? null,
    workerUnavailable,
    workerConnected,
    workerUnavailableMessage: workerUnavailable
      ? workerConnected
        ? "Job is queued but not progressing — check worker logs or rebuild preview."
        : requiresDeployedWorker
          ? "Production cannot run npm builds on Vercel. Deploy worker/preview-worker (Railway/Render) or run npm run preview-worker:dev locally against this project."
          : "Preview worker not connected — run npm run preview-worker:dev or deploy the worker."
      : null,
    jobCreatedAt,
    jobAgeLabel: jobAgeSeconds != null ? formatJobAge(jobAgeSeconds) : null,
    jobAgeSeconds,
    requiresDeployedWorker,
    lastPreviewBuildAt:
      (typeof diag?.lastPreviewBuildAt === "string" ? diag.lastPreviewBuildAt : null) ??
      (typeof meta.last_preview_build_at === "string" ? meta.last_preview_build_at : null),
    entryFile:
      (Array.isArray(diag?.entryFiles) && diag.entryFiles[0]
        ? String(diag.entryFiles[0])
        : null) ??
      (typeof importMeta?.entry_file === "string" ? importMeta.entry_file : null),
    warnings: Array.isArray(diag?.warnings) ? diag.warnings.map(String) : [],
    previewBuildMeta: (() => {
      const raw =
        diag && typeof diag === "object" && "previewBuildMeta" in diag
          ? (diag as Record<string, unknown>).previewBuildMeta
          : null;
      return raw && typeof raw === "object" ? (raw as PreviewBuildMeta) : null;
    })(),
    packageRepairDiagnostics: (() => {
      const d = diag as Record<string, unknown> | null;
      const fromDiag = d?.packageRepairDiagnostics;
      if (fromDiag && typeof fromDiag === "object") {
        return fromDiag as PackageRepairDiagnosticsPayload;
      }
      const meta =
        d?.previewBuildMeta && typeof d.previewBuildMeta === "object"
          ? (d.previewBuildMeta as PreviewBuildMeta)
          : null;
      return meta?.packageRepair ?? null;
    })(),
    estimatedActionCredits: billing?.estimated_action_credits ?? null,
    chargedActionCredits: billing?.charged_action_credits ?? null,
    creditsCharged: billing?.charge_status === "charged",
    chargeStatus,
    previewFailureKind: null,
    previewFailureDetail: null,
  };

  const failure = derivePreviewFailure(payload, meta);
  payload.previewFailureKind = failure.kind;
  payload.previewFailureDetail = failure.detail;

  if (sessionRow?.error && !payload.userMessage) {
    payload.userMessage = sessionRow.error;
  }

  return payload;
}
