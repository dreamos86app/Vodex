import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

export const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export type MobileBuildJobRow = {
  id: string;
  project_id: string;
  owner_id: string;
  platform: string;
  status: string;
  build_type: string | null;
  artifact_type: string | null;
  meta: Record<string, unknown>;
  version_name: string | null;
  version_code: number | null;
};

export async function claimNextJob(): Promise<MobileBuildJobRow | null> {
  const { data, error } = await supabase.rpc("claim_mobile_build_job", {
    p_builder_id: config.builderId,
    p_stale_lock_minutes: 45,
  });
  if (error) throw new Error(`claim_mobile_build_job: ${error.message}`);
  if (!data || (Array.isArray(data) && data.length === 0)) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id) return null;
  return row as MobileBuildJobRow;
}

export async function heartbeat(): Promise<void> {
  await supabase.from("android_builder_heartbeats").upsert({
    builder_id: config.builderId,
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: config.version,
    host: process.env.HOSTNAME ?? "local",
    status: "online",
  });
}
