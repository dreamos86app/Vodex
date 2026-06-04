#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const must = (rel, needle, label) => {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) {
    errors.push(`missing file: ${rel}`);
    return;
  }
  const src = fs.readFileSync(p, "utf8");
  if (!src.includes(needle)) errors.push(label);
};

must("src/app/api/admin/preview-worker/status/route.ts", "loadPreviewWorkerStatus", "admin preview-worker status API");
must("src/lib/preview/preview-worker-status.ts", "WORKER_CONNECTED_THRESHOLD_MS = 90_000", "90s connected threshold");
must("src/lib/preview/preview-worker-status.ts", "preview_worker_heartbeats", "heartbeat table query");
must("worker/preview-worker/src/index.ts", "HEARTBEAT_MS", "worker heartbeat interval");
must("worker/preview-worker/src/index.ts", "preview_worker_heartbeats", "worker upsert heartbeat");
must("worker/preview-worker/src/health-server.ts", 'status: "ok"', "Railway /health JSON");
must("worker/preview-worker/src/health-server.ts", "workerId", "health exposes workerId");
must("src/components/admin/admin-preview-runtime-panel.tsx", "Preview Runtime", "control center panel");
must("supabase/migrations/20260806120000_p33_preview_worker_zip_credits.sql", "preview_worker_heartbeats", "P33 heartbeat migration");

const statusSrc = fs.readFileSync(
  path.join(root, "src/lib/preview/preview-worker-status.ts"),
  "utf8",
);
for (const field of [
  "connected",
  "lastHeartbeatAt",
  "workerCount",
  "pendingJobs",
  "runningJobs",
  "failedJobs24h",
  "completedJobs24h",
  "queueAgeSeconds",
  "workerIds",
]) {
  if (!statusSrc.includes(field)) errors.push(`status payload missing ${field}`);
}

must("package.json", "verify:preview-worker-health", "verify script registered");

if (errors.length) {
  console.error("verify:preview-worker-health FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:preview-worker-health OK");
