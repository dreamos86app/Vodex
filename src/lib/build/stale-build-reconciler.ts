import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { WORKER_CONNECTED_THRESHOLD_MS } from "@/lib/preview/preview-worker-status";

type Writer = SupabaseClient<Database>;

const AI_BUILD_STALE_MS = Number(process.env.DREAMOS_AI_BUILD_STALE_MS ?? 30 * 60 * 1000);
const PREVIEW_BUILD_RUNNING_STALE_MS = Number(
  process.env.DREAMOS_PREVIEW_BUILD_STALE_MS ?? 15 * 60 * 1000,
);
const PREVIEW_QUEUE_NO_WORKER_MS = Number(
  process.env.DREAMOS_PREVIEW_QUEUE_NO_WORKER_MS ?? 8 * 60 * 1000,
);

export type StaleReconcileSummary = {
  aiBuildsReconciled: number;
  previewBuildsReconciled: number;
  previewQueuedWaiting: number;
};

async function workerConnected(admin: Writer): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  const { data } = await db
    .from("preview_worker_heartbeats")
    .select("last_seen_at")
    .order("last_seen_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = data as { last_seen_at?: string } | null;
  if (!row?.last_seen_at) return false;
  return Date.now() - new Date(row.last_seen_at).getTime() < WORKER_CONNECTED_THRESHOLD_MS;
}

/** Reconcile stuck AI build_jobs and preview_build_jobs. */
export async function reconcileStaleBuilds(writer: Writer): Promise<StaleReconcileSummary> {
  const now = Date.now();
  const nowIso = new Date().toISOString();
  let aiBuildsReconciled = 0;
  let previewBuildsReconciled = 0;
  let previewQueuedWaiting = 0;

  const { data: aiJobs } = await writer
    .from("build_jobs")
    .select("id, updated_at, created_at, meta")
    .in("status", ["running", "queued", "starting"])
    .order("created_at", { ascending: false })
    .limit(200);

  for (const job of aiJobs ?? []) {
    const last = new Date(job.updated_at ?? job.created_at).getTime();
    if (now - last < AI_BUILD_STALE_MS) continue;
    const meta =
      job.meta && typeof job.meta === "object" && !Array.isArray(job.meta)
        ? (job.meta as Record<string, unknown>)
        : {};
    await writer
      .from("build_jobs")
      .update({
        status: "failed",
        error_message: "Build timed out — marked stale by system",
        completed_at: nowIso,
        meta: {
          ...meta,
          stale_reason: "ai_build_no_heartbeat",
          reconciled_at: nowIso,
          last_event_at: job.updated_at ?? job.created_at,
        },
      } as never)
      .eq("id", job.id);
    aiBuildsReconciled += 1;
  }

  const connected = await workerConnected(writer);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = writer as any;
  const { data: previewJobs } = await admin
    .from("preview_build_jobs")
    .select("id, status, created_at, updated_at, project_id, diagnostics")
    .in("status", ["running", "queued"])
    .order("created_at", { ascending: false })
    .limit(200);

  for (const job of previewJobs ?? []) {
    const last = new Date(job.updated_at ?? job.created_at).getTime();
    const age = now - last;
    const diag =
      job.diagnostics && typeof job.diagnostics === "object"
        ? (job.diagnostics as Record<string, unknown>)
        : {};

    if (job.status === "queued" && !connected && age > PREVIEW_QUEUE_NO_WORKER_MS) {
      await admin
        .from("preview_build_jobs")
        .update({
          diagnostics: {
            ...diag,
            waiting_for_worker: true,
            stale_reason: "queued_no_worker",
            reconciled_at: nowIso,
          },
          updated_at: nowIso,
        })
        .eq("id", job.id);
      previewQueuedWaiting += 1;
      continue;
    }

    if (job.status === "running" && age > PREVIEW_BUILD_RUNNING_STALE_MS) {
      await admin
        .from("preview_build_jobs")
        .update({
          status: "failed",
          blocked_reason: "Preview build timed out",
          finished_at: nowIso,
          updated_at: nowIso,
          diagnostics: {
            ...diag,
            previewStatus: "failed",
            stale_reason: "preview_build_timeout",
            reconciled_at: nowIso,
            last_event_at: job.updated_at ?? job.created_at,
          },
        })
        .eq("id", job.id);
      previewBuildsReconciled += 1;
    }
  }

  return { aiBuildsReconciled, previewBuildsReconciled, previewQueuedWaiting };
}
