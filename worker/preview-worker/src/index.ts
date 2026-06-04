import { config } from "./config.js";
import { log } from "./logger.js";
import { claimNextJob, supabase } from "./supabase.js";
import { runJob } from "./job-runner.js";

async function heartbeat(): Promise<void> {
  await supabase.from("preview_worker_heartbeats").upsert({
    worker_id: config.workerId,
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
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
  log("info", "preview worker started", {
    workerId: config.workerId,
    concurrency: config.jobConcurrency,
  });
  for (;;) {
    try {
      await heartbeat();
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
