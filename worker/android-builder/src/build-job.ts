import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { config } from "./config.js";
import { extractWrapperZip, runGradleBuild } from "./gradle-build.js";
import { postBuilderCallback } from "./callback.js";
import { supabase, type MobileBuildJobRow } from "./supabase.js";

export async function processBuildJob(job: MobileBuildJobRow): Promise<void> {
  const meta = job.meta ?? {};
  const wrapperPath =
    (typeof meta.wrapper_storage_path === "string" && meta.wrapper_storage_path) ||
    (typeof meta.storage_path === "string" && meta.storage_path) ||
    null;
  const buildType = (job.build_type ?? job.artifact_type) as "apk" | "aab" | null;

  if (!wrapperPath || !buildType || (buildType !== "apk" && buildType !== "aab")) {
    await postBuilderCallback({
      jobId: job.id,
      buildType: "apk",
      storagePath: "",
      byteSize: 0,
      logs: "",
      errorMessage: "Invalid job: missing wrapper path or build type",
    });
    return;
  }

  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "vodex-android-"));
  try {
    const { data: zipBlob, error: dlErr } = await supabase.storage
      .from(config.mediaBucket)
      .download(wrapperPath);
    if (dlErr || !zipBlob) {
      await postBuilderCallback({
        jobId: job.id,
        buildType,
        storagePath: "",
        byteSize: 0,
        logs: "",
        errorMessage: dlErr?.message ?? "Wrapper ZIP download failed",
      });
      return;
    }

    await extractWrapperZip(Buffer.from(await zipBlob.arrayBuffer()), workspace);
    const result = await runGradleBuild({ workspace, buildType });

    if (!result.ok) {
      await postBuilderCallback({
        jobId: job.id,
        buildType,
        storagePath: "",
        byteSize: 0,
        logs: result.logs,
        errorMessage: result.error,
      });
      return;
    }

    const artifactBuffer = await fs.readFile(result.artifactPath);
    const ext = buildType === "aab" ? "aab" : "apk";
    const storagePath = `${job.owner_id}/mobile/${job.project_id}/${job.id}-${Date.now().toString(36)}.${ext}`;
    const contentType =
      buildType === "aab" ? "application/octet-stream" : "application/vnd.android.package-archive";

    const { error: upErr } = await supabase.storage.from(config.mediaBucket).upload(storagePath, artifactBuffer, {
      contentType,
      upsert: false,
    });
    if (upErr) {
      await postBuilderCallback({
        jobId: job.id,
        buildType,
        storagePath: "",
        byteSize: 0,
        logs: result.logs,
        errorMessage: upErr.message,
      });
      return;
    }

    await postBuilderCallback({
      jobId: job.id,
      buildType,
      storagePath,
      byteSize: artifactBuffer.length,
      logs: result.logs,
    });
  } finally {
    await fs.rm(workspace, { recursive: true, force: true }).catch(() => undefined);
  }
}
