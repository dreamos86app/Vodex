import "dotenv/config";
import http from "node:http";
import { config } from "./config.js";
import { claimNextJob, heartbeat } from "./supabase.js";
import { processBuildJob } from "./build-job.js";
import type { AndroidBuildDispatchPayload } from "./webhook-types.js";

let active = 0;

function verifySecret(req: http.IncomingMessage): boolean {
  if (!config.builderSecret) return true;
  return req.headers["x-builder-secret"] === config.builderSecret;
}

function startHttpServer(): void {
  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, builderId: config.builderId }));
      return;
    }

    if (req.method === "POST" && req.url === "/v1/build") {
      if (!verifySecret(req)) {
        res.writeHead(401);
        res.end("Unauthorized");
        return;
      }
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        void (async () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as AndroidBuildDispatchPayload;
            const job = {
              id: body.jobId,
              project_id: body.projectId,
              owner_id: body.ownerId,
              platform: "android",
              status: "queued",
              build_type: body.buildType,
              artifact_type: body.buildType,
              meta: {
                wrapper_storage_path: body.wrapperStoragePath,
                wrapper_download_url: body.wrapperDownloadUrl,
              },
              version_name: body.versionName,
              version_code: body.versionCode,
            };
            active += 1;
            void processBuildJob(job)
              .catch((e) => console.error("[android-builder] job error", e))
              .finally(() => {
                active -= 1;
              });
            res.writeHead(202, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ accepted: true, jobId: body.jobId }));
          } catch (e) {
            res.writeHead(400);
            res.end(e instanceof Error ? e.message : "Bad request");
          }
        })();
      });
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  server.listen(config.port, () => {
    console.log(`[android-builder] listening on :${config.port}`);
  });
}

async function pollLoop(): Promise<void> {
  while (active < 2) {
    const job = await claimNextJob();
    if (!job?.id) break;
    active += 1;
    void processBuildJob(job)
      .catch((e) => console.error("[android-builder] poll job error", e))
      .finally(() => {
        active -= 1;
      });
  }
}

async function main(): Promise<void> {
  startHttpServer();
  await heartbeat();
  setInterval(() => void heartbeat(), 30_000);
  setInterval(() => void pollLoop(), config.pollIntervalMs);
  console.log("[android-builder] started", {
    builderId: config.builderId,
    androidHome: config.androidHome || "(not set)",
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
