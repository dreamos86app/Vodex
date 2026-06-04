import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";
import { log } from "./logger.js";

const REQUIRED_ENV = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export async function runStartupChecks(): Promise<void> {
  for (const name of REQUIRED_ENV) {
    if (!process.env[name]?.trim()) {
      log("error", `Missing required environment variable: ${name}`);
      process.exit(1);
    }
  }

  log("info", "environment ok", {
    artifactBucket: config.artifactBucket,
    sourceBucket: config.sourceBucket,
    workerId: config.workerId,
  });

  const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const bucket of [config.artifactBucket, config.sourceBucket]) {
    const { error } = await supabase.storage.from(bucket).list("", { limit: 1 });
    if (error) {
      log("error", `Bucket missing or inaccessible: ${bucket}`, { error: error.message });
      process.exit(1);
    }
    log("info", `bucket ok: ${bucket}`);
  }

  const { error: tableError } = await supabase.from("preview_build_jobs").select("id").limit(1);
  if (tableError) {
    log("error", "preview_build_jobs table unavailable", { error: tableError.message });
    process.exit(1);
  }
  log("info", "preview_build_jobs table ok");

  const { error: rpcError } = await supabase.rpc("claim_preview_build_job", {
    p_worker_id: config.workerId,
    p_stale_lock_minutes: 30,
  });
  if (rpcError) {
    log("error", "claim_preview_build_job RPC missing or failed", { error: rpcError.message });
    process.exit(1);
  }
  log("info", "claim_preview_build_job RPC ok");
}
