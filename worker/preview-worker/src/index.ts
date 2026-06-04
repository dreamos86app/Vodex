import "dotenv/config";
import { sanitizeInheritedNodeOptionsForWorkerBoot } from "./sanitize-node-options.js";

sanitizeInheritedNodeOptionsForWorkerBoot();

import { config } from "./config.js";
import { log } from "./logger.js";
import { claimNextJob, supabase } from "./supabase.js";
import { runJob } from "./job-runner.js";
import { runStartupChecks } from "./startup-checks.js";
import { startHealthServer } from "./health-server.js";

const WORKER_VERSION = process.env.WORKER_VERSION?.trim() ?? "0.1.0";
const HEARTBEAT_MS = Number(process.env.PREVIEW_HEARTBEAT_MS ?? 30_000);

async function heartbeat(): Promise<void> {
  const { error } = await supabase.from("preview_worker_heartbeats").upsert({
    worker_id: config.workerId,
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: WORKER_VERSION,
    host:
      process.env.RAILWAY_REPLICA_ID?.trim() ??
      process.env.HOSTNAME?.trim() ??
      process.env.COMPUTERNAME?.trim() ??
      "local",
    status: "online",
  });
  if (error) {
    log("error", "heartbeat failed", { error: error.message });
  }
}

let active = 0;

async function pollOnce(): Promise<void> {
  while (active < config.jobConcurrency) {
    const job = await claimNextJob();
    if (!job?.id) break;
    active += 1;
    void runJob(job)
      .catch((e) => log("error", "unhandled job failure", { error: String(e) }))
      .finally(() => {
        active -= 1;
      });
  }
}

async function main(): Promise<void> {
  await runStartupChecks();
  startHealthServer();
  await heartbeat();
  setInterval(() => void heartbeat(), HEARTBEAT_MS);

  log("info", "preview worker started", {
    workerId: config.workerId,
    concurrency: config.jobConcurrency,
    heartbeatMs: HEARTBEAT_MS,
  });

  for (;;) {
    try {
      await pollOnce();
    } catch (e) {
      log("error", "poll failed", { error: e instanceof Error ? e.message : String(e) });
    }
    await new Promise((r) => setTimeout(r, config.pollIntervalMs));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
