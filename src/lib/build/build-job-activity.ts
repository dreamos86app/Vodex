import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { BUILD_USER_TIMEOUT_MS } from "@/lib/build/build-step-ui";

type Writer = SupabaseClient<Database>;

/** Max idle time before a running build_job is considered stale (matches UI timeout + buffer). */
export const BUILD_JOB_STALE_MS = Number(
  process.env.DREAMOS_STALE_BUILD_MS ?? BUILD_USER_TIMEOUT_MS + 5 * 60_000,
);

export async function touchBuildJobActivity(
  writer: Writer,
  jobId: string,
  progressPercent?: number | null,
): Promise<void> {
  await writer
    .from("build_jobs")
    .update({
      updated_at: new Date().toISOString(),
      ...(typeof progressPercent === "number"
        ? { progress_percent: Math.min(100, Math.max(0, progressPercent)) }
        : {}),
    } as never)
    .eq("id", jobId);
}

/** Latest heartbeat from job row or most recent build_job_event. */
export async function getLatestBuildJobActivityMs(
  writer: Writer,
  jobId: string,
): Promise<number | null> {
  const [{ data: job }, { data: lastEvent }] = await Promise.all([
    writer.from("build_jobs").select("updated_at, created_at").eq("id", jobId).maybeSingle(),
    writer
      .from("build_job_events")
      .select("created_at")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const candidates = [
    job?.updated_at ? Date.parse(job.updated_at) : NaN,
    job?.created_at ? Date.parse(job.created_at) : NaN,
    lastEvent?.created_at ? Date.parse(lastEvent.created_at) : NaN,
  ].filter((t) => Number.isFinite(t));

  return candidates.length ? Math.max(...candidates) : null;
}

export function isBuildJobStale(lastActivityMs: number | null, now = Date.now()): boolean {
  if (lastActivityMs == null) return false;
  return now - lastActivityMs >= BUILD_JOB_STALE_MS;
}
