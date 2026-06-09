import * as fs from "node:fs/promises";
import JSZip from "jszip";
import { config } from "./config.js";
import { log, redactSecrets } from "./logger.js";
import { supabase, type PreviewBuildJobRow } from "./supabase.js";
import {
  cleanupWorkspace,
  createWorkspace,
  findIndexHtmlPath,
  writeWorkspaceFiles,
  type WorkspaceFile,
  norm,
  isSafeRelativePath,
} from "./sandbox.js";
import { detectFramework } from "./framework.js";
import { buildStatic } from "./builders/static-builder.js";
import { buildVite } from "./builders/vite-builder.js";
import { buildNext } from "./builders/next-builder.js";
import { uploadArtifacts } from "./upload-artifacts.js";
import { checkPreviewHealth } from "./health-check.js";
import { detectLegacy } from "./adapters/base44-adapter.js";
import { captureZipPreviewCredits, cancelZipPreviewHold } from "./zip-credits.js";
import { runWorkerZipAutoRepair } from "./repair/zip-auto-repair.js";
import { loadPreviewBuildEnv } from "./project-secrets.js";

async function downloadSourceZip(snapshotPath: string): Promise<WorkspaceFile[]> {
  const { data, error } = await supabase.storage.from(config.sourceBucket).download(snapshotPath);
  if (error || !data) throw new Error(`Source download failed: ${error?.message ?? "missing"}`);
  const zip = await JSZip.loadAsync(Buffer.from(await data.arrayBuffer()));
  const files: WorkspaceFile[] = [];
  const entries = Object.values(zip.files);
  for (const entry of entries) {
    if (entry.dir) continue;
    const p = norm(entry.name);
    if (!isSafeRelativePath(p)) continue;
    const content = await entry.async("string");
    files.push({ path: p, content });
  }
  return files;
}

async function loadSourceFiles(job: PreviewBuildJobRow): Promise<WorkspaceFile[]> {
  if (job.source_snapshot_path) {
    return downloadSourceZip(job.source_snapshot_path);
  }
  const { data, error } = await supabase
    .from("app_files")
    .select("path, content")
    .eq("project_id", job.project_id);
  if (error || !data?.length) {
    throw new Error("No source snapshot and no app_files rows");
  }
  return data.map((r) => ({
    path: String(r.path),
    content: String(r.content ?? ""),
  }));
}

async function applyProjectMetadata(
  job: PreviewBuildJobRow,
  diagnostics: Record<string, unknown>,
): Promise<void> {
  const { data: project } = await supabase
    .from("projects")
    .select("metadata")
    .eq("id", job.project_id)
    .maybeSingle();

  const prev =
    project?.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
      ? (project.metadata as Record<string, unknown>)
      : {};

  const previewRenderable = Boolean(diagnostics.previewRenderable);
  await supabase
    .from("projects")
    .update({
      preview_url: previewRenderable ? diagnostics.previewUrl : null,
      metadata: {
        ...prev,
        imported_framework: diagnostics.framework,
        preview_status: diagnostics.previewStatus,
        preview_artifact_path: diagnostics.artifactPath,
        preview_blocked_reason: diagnostics.blockedReason,
        preview_diagnostics: diagnostics,
        preview_renderable: previewRenderable,
        source_integrity_ok: diagnostics.sourceIntegrityOk,
        preview_ready: previewRenderable,
        preview_honest: previewRenderable,
        last_preview_build_at: diagnostics.lastPreviewBuildAt,
        preview_job_id: job.id,
      },
    })
    .eq("id", job.project_id);
}

export async function runJob(job: PreviewBuildJobRow): Promise<void> {
  const workspace = await createWorkspace(job.project_id);
  let logs = "";
  try {
    log("info", "job started", { jobId: job.id, projectId: job.project_id });
    let files = await loadSourceFiles(job);
    const repair = runWorkerZipAutoRepair(files);
    if (repair.actions.length) {
      log("info", "zip auto-repair applied", {
        jobId: job.id,
        actions: repair.actions.length,
        blockers: repair.blockers,
      });
      files = repair.files;
    }
    if (repair.blockers.length) {
      log("warn", "zip auto-repair blockers", { blockers: repair.blockers });
    }
    const { env: secretEnv, injectedNames } = await loadPreviewBuildEnv(job.project_id);
    if (injectedNames.length) {
      Object.assign(process.env, secretEnv);
    }
    await writeWorkspaceFiles(workspace, files);
    const framework = detectFramework(files);
    const legacy = detectLegacy(files);
    const warnings: string[] = [];
    if (legacy.base44) warnings.push("Legacy Base44 SDK detected — preview uses safe env shims only");
    if (legacy.lovable) warnings.push("Lovable/Supabase env may be missing — preview uses mock values");

    let result:
      | { ok: true; outputDir: string; logs: string; buildMeta?: Record<string, unknown> }
      | { ok: false; logs: string; blockedReason: string; buildMeta?: Record<string, unknown> };

    const fw = framework.id;
    log("info", "build route selected", { frameworkId: fw, packageManager: framework.packageManager });
    if (fw === "static") result = await buildStatic(workspace, files);
    else if (["vite", "react", "base44", "lovable", "bolt", "v0", "cra"].includes(fw)) {
      const viteResult = await buildVite(workspace, framework, files);
      result = {
        ...viteResult,
        buildMeta: viteResult.buildMeta as unknown as Record<string, unknown>,
      };
    } else if (fw === "nextjs_app" || fw === "nextjs_pages") {
      result = await buildNext(workspace, framework, files);
    } else {
      result = {
        ok: false,
        logs: "unknown framework",
        blockedReason: "Could not detect a supported framework for worker build",
      };
    }

    logs += result.logs;
    const previewBuildMeta = result.buildMeta ?? null;
    if (!result.ok) {
      await cancelZipPreviewHold(job.project_id);
      const buildMeta = previewBuildMeta as Record<string, unknown> | null;
      const errorCode =
        buildMeta && typeof buildMeta.errorCode === "string" ? buildMeta.errorCode : null;
      const userMessage =
        buildMeta && typeof buildMeta.userMessage === "string" ? buildMeta.userMessage : null;
      await finishJob(job, {
        status: "failed",
        blockedReason: result.blockedReason,
        logs,
        previewRenderable: false,
        framework: fw,
        warnings,
        previewBuildMeta,
        diagnostics: {
          framework: fw,
          frameworkLabel: framework.label,
          previewStatus: "failed",
          previewRenderable: false,
          sourceIntegrityOk: false,
          blockedReason: result.blockedReason,
          errorCode,
          userMessage,
          buildLogs: redactSecrets(logs).slice(0, 50000),
          previewBuildMeta,
          packageRepairDiagnostics:
            buildMeta && typeof buildMeta.packageRepair === "object"
              ? buildMeta.packageRepair
              : null,
          warnings,
          zipAutoRepair: repair.actions.length ? { actions: repair.actions, blockers: repair.blockers } : null,
          injected_secret_names: injectedNames,
          lastPreviewBuildAt: new Date().toISOString(),
          jobId: job.id,
        },
      });
      return;
    }

    const indexFile = await findIndexHtmlPath(result.outputDir);
    const indexHtml = indexFile
      ? await fs.readFile(indexFile, "utf8").catch(() => "")
      : "";
    const health = checkPreviewHealth(indexHtml);
    if (!health.previewRenderable) {
      await finishJob(job, {
        status: "failed",
        blockedReason: health.blockedReason,
        logs: `${logs}\n[health] ${health.blockedReason}`,
        previewRenderable: false,
        framework: fw,
        warnings,
      });
      return;
    }

    const upload = await uploadArtifacts(job.project_id, job.id, result.outputDir);
    if (!upload.ok) {
      await finishJob(job, {
        status: "failed",
        blockedReason: upload.error,
        logs: `${logs}\n[upload] ${upload.error}`,
        previewRenderable: false,
        framework: fw,
        warnings,
      });
      return;
    }

    const previewUrl = `/api/projects/${encodeURIComponent(job.project_id)}/preview-html?format=frame&artifact=${encodeURIComponent(job.id)}`;
    const diagnostics = {
      framework: fw,
      frameworkLabel: framework.label,
      previewStatus: "ready",
      previewRenderable: true,
      sourceIntegrityOk: true,
      blockedReason: null,
      artifactPath: upload.artifactPath,
      previewUrl,
      buildLogs: redactSecrets(logs).slice(0, 50000),
      previewBuildMeta,
      warnings,
      zipAutoRepair: repair.actions.length ? { actions: repair.actions, blockers: repair.blockers } : null,
      injected_secret_names: injectedNames,
      lastPreviewBuildAt: new Date().toISOString(),
      jobId: job.id,
    };

    await finishJob(job, {
      status: "succeeded",
      blockedReason: null,
      logs: diagnostics.buildLogs,
      previewRenderable: true,
      framework: fw,
      warnings,
      artifactPath: upload.artifactPath,
      diagnostics,
    });
    await captureZipPreviewCredits(job.project_id, job.owner_id);
    log("info", "job succeeded", { jobId: job.id, files: upload.fileCount });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Job failed";
    log("error", "job error", { jobId: job.id, error: msg });
    await finishJob(job, {
      status: "failed",
      blockedReason: msg,
      logs: redactSecrets(`${logs}\n${msg}`),
      previewRenderable: false,
      framework: job.framework,
      warnings: [],
    });
  } finally {
    await cleanupWorkspace(workspace);
  }
}

async function finishJob(
  job: PreviewBuildJobRow,
  input: {
    status: string;
    blockedReason: string | null;
    logs: string;
    previewRenderable: boolean;
    framework: string | null;
    warnings: string[];
    artifactPath?: string;
    diagnostics?: Record<string, unknown>;
    previewBuildMeta?: Record<string, unknown> | null;
  },
): Promise<void> {
  const previewBuildMeta = input.previewBuildMeta ?? null;
  const packageRepairDiagnostics =
    previewBuildMeta &&
    typeof previewBuildMeta === "object" &&
    "packageRepair" in previewBuildMeta
      ? (previewBuildMeta as { packageRepair?: unknown }).packageRepair
      : null;

  const diagnostics =
    input.diagnostics ??
    ({
      framework: input.framework,
      previewStatus: input.status === "succeeded" ? "ready" : "failed",
      previewRenderable: input.previewRenderable,
      sourceIntegrityOk: input.previewRenderable,
      blockedReason: input.blockedReason,
      buildLogs: input.logs,
      previewBuildMeta,
      packageRepairDiagnostics,
      warnings: input.warnings,
      lastPreviewBuildAt: new Date().toISOString(),
      jobId: job.id,
    } as Record<string, unknown>);

  await supabase
    .from("preview_build_jobs")
    .update({
      status: input.status,
      blocked_reason: input.blockedReason,
      build_logs: input.logs.slice(0, 50000),
      logs: input.logs.slice(0, 50000),
      artifact_path: input.artifactPath ?? null,
      preview_renderable: input.previewRenderable,
      source_integrity_ok: input.previewRenderable,
      diagnostics,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  await applyProjectMetadata(job, diagnostics);
}
