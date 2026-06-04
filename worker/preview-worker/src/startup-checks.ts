import { config, serviceRoleKeyPrefix } from "./config.js";
import { log } from "./logger.js";
import { assertServiceRoleDbAccess, supabase } from "./supabase.js";

const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;

const FORBIDDEN_KEY_ENV = [
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "VITE_SUPABASE_ANON_KEY",
  "SUPABASE_ANON_KEY",
] as const;

export async function runStartupChecks(): Promise<void> {
  for (const name of REQUIRED_ENV) {
    if (!process.env[name]?.trim()) {
      log("error", `Missing required environment variable: ${name}`);
      process.exit(1);
    }
  }

  const hasServiceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  log("info", "supabase credentials", {
    hasServiceRoleKey,
    serviceRoleKeyPrefix: serviceRoleKeyPrefix(),
    supabaseUrl: config.supabaseUrl,
  });

  for (const name of FORBIDDEN_KEY_ENV) {
    const anon = process.env[name]?.trim();
    if (anon && anon === config.supabaseServiceRoleKey) {
      log("error", `${name} is set to the same value as SUPABASE_SERVICE_ROLE_KEY — use the service role JWT only`, {
        env: name,
      });
      process.exit(1);
    }
  }

  log("info", "environment ok", {
    artifactBucket: config.artifactBucket,
    sourceBucket: config.sourceBucket,
    workerId: config.workerId,
  });

  for (const bucket of [config.artifactBucket, config.sourceBucket]) {
    const { error } = await supabase.storage.from(bucket).list("", { limit: 1 });
    if (error) {
      log("error", `Bucket missing or inaccessible: ${bucket}`, { error: error.message });
      process.exit(1);
    }
    log("info", `bucket ok: ${bucket}`);
  }

  try {
    await assertServiceRoleDbAccess();
  } catch (e) {
    log("error", e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
  log("info", "preview_build_jobs table ok (service role)");

  const { error: rpcError } = await supabase.rpc("claim_preview_build_job", {
    p_worker_id: config.workerId,
    p_stale_lock_minutes: 30,
  });
  if (rpcError) {
    if (rpcError.code === "42501" || /permission denied/i.test(rpcError.message ?? "")) {
      log(
        "error",
        "Service role key is not being used or RLS is blocking service-role access.",
        { rpc: "claim_preview_build_job" },
      );
    } else {
      log("error", "claim_preview_build_job RPC missing or failed", { error: rpcError.message });
    }
    process.exit(1);
  }
  log("info", "claim_preview_build_job RPC ok");
}
