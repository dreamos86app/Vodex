import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { PreviewWorkerStatusPayload } from "@/lib/preview/preview-worker-labels";

type WorkerHeartbeatRow = PreviewWorkerStatusPayload["workers"][number];

export type { PreviewWorkerStatusPayload };
export { formatHeartbeatAge } from "@/lib/preview/preview-worker-labels";

export const WORKER_CONNECTED_THRESHOLD_MS = 90_000;

export async function loadPreviewWorkerStatus(): Promise<PreviewWorkerStatusPayload> {
  const admin = createSupabaseAdmin();
  if (!admin) {
    return {
      connected: false,
      lastHeartbeatAt: null,
      workerCount: 0,
      pendingJobs: 0,
      runningJobs: 0,
      failedJobs24h: 0,
      completedJobs24h: 0,
      queueAgeSeconds: 0,
      workerIds: [],
      workers: [],
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  const now = Date.now();
  const since24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const { data: heartbeats } = await db
    .from("preview_worker_heartbeats")
    .select("worker_id, last_seen_at, updated_at, version, host, status")
    .order("last_seen_at", { ascending: false })
    .limit(20);

  const workers: WorkerHeartbeatRow[] = (heartbeats ?? []).map(
    (row: {
      worker_id: string;
      last_seen_at: string;
      version?: string | null;
      host?: string | null;
      status?: string | null;
    }) => {
      const at = new Date(row.last_seen_at).getTime();
      return {
        workerId: row.worker_id,
        lastHeartbeatAt: row.last_seen_at,
        version: row.version ?? null,
        host: row.host ?? null,
        status: row.status ?? null,
        ageSeconds: Math.max(0, Math.floor((now - at) / 1000)),
      };
    },
  );

  const connectedWorkers = workers.filter(
    (w: WorkerHeartbeatRow) => w.ageSeconds * 1000 < WORKER_CONNECTED_THRESHOLD_MS,
  );
  const connected = connectedWorkers.length > 0;
  const lastHeartbeatAt = workers[0]?.lastHeartbeatAt ?? null;

  const [{ count: pendingJobs }, { count: runningJobs }, { count: failedJobs24h }, { count: completedJobs24h }] =
    await Promise.all([
      db
        .from("preview_build_jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", "queued"),
      db
        .from("preview_build_jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", "running"),
      db
        .from("preview_build_jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed")
        .gte("created_at", since24h),
      db
        .from("preview_build_jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", "succeeded")
        .gte("created_at", since24h),
    ]);

  const { data: oldestQueued } = await db
    .from("preview_build_jobs")
    .select("created_at")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const queueAgeSeconds = oldestQueued?.created_at
    ? Math.max(0, Math.floor((now - new Date(oldestQueued.created_at).getTime()) / 1000))
    : 0;

  return {
    connected,
    lastHeartbeatAt,
    workerCount: connectedWorkers.length,
    pendingJobs: pendingJobs ?? 0,
    runningJobs: runningJobs ?? 0,
    failedJobs24h: failedJobs24h ?? 0,
    completedJobs24h: completedJobs24h ?? 0,
    queueAgeSeconds,
    workerIds: connectedWorkers.map((w: WorkerHeartbeatRow) => w.workerId),
    workers,
  };
}
