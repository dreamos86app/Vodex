import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

export const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      apikey: config.supabaseServiceRoleKey,
    },
  },
});

export type PreviewBuildJobRow = {
  id: string;
  project_id: string;
  owner_id: string;
  status: string;
  framework: string | null;
  source_snapshot_path: string | null;
  artifact_path: string | null;
  runtime_mode: string | null;
  blocked_reason: string | null;
  diagnostics: Record<string, unknown>;
  build_logs: string | null;
  logs: string | null;
};

function isPermissionDenied(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42501" || /permission denied/i.test(error.message ?? "");
}

/** Startup probe — fails fast if PostgREST is not using the service role. */
export async function assertServiceRoleDbAccess(): Promise<void> {
  const { error } = await supabase.from("preview_build_jobs").select("id").limit(1);
  if (error) {
    if (isPermissionDenied(error)) {
      throw new Error(
        "Service role key is not being used or RLS is blocking service-role access.",
      );
    }
    throw new Error(`preview_build_jobs probe failed: ${error.message}`);
  }
}

export async function claimNextJob(): Promise<PreviewBuildJobRow | null> {
  const { data, error } = await supabase.rpc("claim_preview_build_job", {
    p_worker_id: config.workerId,
    p_stale_lock_minutes: 30,
  });
  if (error) {
    if (isPermissionDenied(error)) {
      throw new Error(
        "Service role key is not being used or RLS is blocking service-role access.",
      );
    }
    throw new Error(`claim_preview_build_job: ${error.message}`);
  }
  if (!data || (Array.isArray(data) && data.length === 0)) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id) return null;
  return row as PreviewBuildJobRow;
}
