import "server-only";

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  analyzeImportedProjectFiles,
  analysisToDiagnostics,
  type AnalyzedImportProject,
} from "@/lib/imports/analyze-imported-project";
import {
  cleanupSandbox,
  createImportSandbox,
  resolveArtifactOutputDir,
} from "@/lib/imports/import-sandbox";
import { injectPreviewShims } from "@/lib/imports/base44-lovable-adapter";
import { checkPreviewHealth } from "@/lib/imports/preview-health-check";
import {
  uploadPreviewArtifacts,
  PREVIEW_ARTIFACTS_BUCKET,
} from "@/lib/imports/preview-artifact-writer";
import { buildStaticPreviewHtmlDetailed } from "@/lib/preview/static-preview-builder";
import { projectPreviewFrameUrl } from "@/lib/preview/preview-frame-url";
import {
  emptyImportDiagnostics,
  type ImportPreviewDiagnostics,
} from "@/lib/imports/import-diagnostics";
import type { ZipImportFile } from "@/lib/import/zip-file-validator";
import {
  canExecuteInlinePreviewBuild,
  frameworkNeedsWorkerBuild,
  queuePreviewBuildJob,
} from "@/lib/imports/preview-build-queue";
import type { DetectedFrameworkId } from "@/lib/imports/framework-detector";

const execFileAsync = promisify(execFile);

const INSTALL_TIMEOUT_MS = 120_000;
const BUILD_TIMEOUT_MS = 180_000;

export type PreviewBuildRunResult = {
  diagnostics: ImportPreviewDiagnostics;
  jobId: string | null;
};

/** @deprecated Use canExecuteInlinePreviewBuild from preview-build-queue */
export function canExecuteNpmPreviewBuild(): boolean {
  return canExecuteInlinePreviewBuild();
}

async function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 4 * 1024 * 1024,
      env: {
        ...process.env,
        NODE_ENV: "production",
        CI: "true",
      },
    });
    return { ok: true, stdout: String(stdout), stderr: String(stderr) };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    return {
      ok: false,
      stdout: String(err.stdout ?? ""),
      stderr: String(err.stderr ?? err.message ?? "command failed"),
    };
  }
}

async function tryNpmBuild(
  workspaceRoot: string,
  framework: AnalyzedImportProject["framework"],
): Promise<{ ok: boolean; outputDir: string | null; logs: string }> {
  const pm = framework.packageManager;
  const installCmd = pm === "pnpm" ? "pnpm" : pm === "yarn" ? "yarn" : "npm";
  const installArgs =
    pm === "pnpm"
      ? ["install", "--frozen-lockfile", "--ignore-scripts"]
      : pm === "yarn"
        ? ["install", "--ignore-scripts"]
        : ["ci", "--ignore-scripts"];

  let logs = "";
  const install = await runCommand(installCmd, installArgs, workspaceRoot, INSTALL_TIMEOUT_MS);
  logs += `[install]\n${install.stdout}\n${install.stderr}\n`;
  if (!install.ok) {
    const fallback = await runCommand("npm", ["install", "--ignore-scripts"], workspaceRoot, INSTALL_TIMEOUT_MS);
    logs += `[install fallback npm]\n${fallback.stdout}\n${fallback.stderr}\n`;
    if (!fallback.ok) return { ok: false, outputDir: null, logs };
  }

  const buildScript = framework.scripts.build ?? "build";
  const build = await runCommand(
    pm === "yarn" ? "yarn" : "npm",
    pm === "yarn" ? [buildScript] : ["run", buildScript],
    workspaceRoot,
    BUILD_TIMEOUT_MS,
  );
  logs += `[build]\n${build.stdout}\n${build.stderr}\n`;
  if (!build.ok) return { ok: false, outputDir: null, logs };

  const { dir } = resolveArtifactOutputDir(framework.id, workspaceRoot);
  try {
    await fs.access(path.join(dir, "index.html"));
    return { ok: true, outputDir: dir, logs };
  } catch {
    return { ok: false, outputDir: null, logs: `${logs}\nMissing index.html in ${dir}` };
  }
}

function buildStaticSnapshotHtml(
  files: ZipImportFile[],
  projectId: string,
  analysis: AnalyzedImportProject,
): { html: string; primaryFile: string | null; logs: string } {
  const snapshot = buildStaticPreviewHtmlDetailed(
    files.map((f) => ({ path: f.path, content: f.content })),
    { projectId, archetypeId: null },
  );
  let html = snapshot.html;
  html = injectPreviewShims(html, analysis.legacy);
  return {
    html,
    primaryFile: snapshot.primaryFile,
    logs: `static_snapshot:${snapshot.rendererSource}`,
  };
}

async function writeHtmlArtifact(
  admin: SupabaseClient,
  projectId: string,
  buildId: string,
  html: string,
): Promise<{ ok: true; artifactPath: string } | { ok: false; error: string }> {
  const sandbox = await createImportSandbox(
    [{ path: "index.html", content: html, sizeBytes: Buffer.byteLength(html, "utf8") }],
    projectId,
  );
  try {
    return await uploadPreviewArtifacts({
      admin,
      projectId,
      buildId,
      sourceDir: sandbox.rootDir,
    });
  } finally {
    await cleanupSandbox(sandbox.rootDir);
  }
}

export async function runImportPreviewBuild(input: {
  admin: SupabaseClient;
  userId: string;
  projectId: string;
  files: ZipImportFile[];
  existingJobId?: string | null;
}): Promise<PreviewBuildRunResult> {
  const analysis = analyzeImportedProjectFiles(input.files);
  const now = new Date().toISOString();
  let diagnostics = analysisToDiagnostics(analysis, {
    previewStatus: "analyzing",
    lastPreviewBuildAt: now,
  });

  const jobId = input.existingJobId ?? crypto.randomUUID();
  const buildId = jobId;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = input.admin as any;

  if (analysis.blockers.length > 0) {
    diagnostics = {
      ...diagnostics,
      previewStatus: "failed",
      previewRenderable: false,
      blockedReason: analysis.blockers[0] ?? "Import blocked",
      buildLogs: analysis.blockers.join("\n"),
    };
    await db
      .from("preview_build_jobs")
      .update({
        status: "failed",
        blocked_reason: diagnostics.blockedReason,
        preview_renderable: false,
        build_logs: diagnostics.buildLogs,
        diagnostics,
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    return { diagnostics, jobId };
  }

  const fw = analysis.framework.id as DetectedFrameworkId;
  if (frameworkNeedsWorkerBuild(fw) && !canExecuteInlinePreviewBuild()) {
    return queuePreviewBuildJob({
      admin: input.admin,
      userId: input.userId,
      projectId: input.projectId,
      files: input.files,
      jobId,
    });
  }

  await db.from("preview_build_jobs").upsert({
    id: jobId,
    project_id: input.projectId,
    owner_id: input.userId,
    status: "running",
    framework: analysis.framework.id,
    started_at: now,
    updated_at: now,
    diagnostics,
  });

  const sourceFiles = input.files.map((f) => ({ path: f.path, content: f.content }));
  let buildLogs = "";
  let artifactPath: string | null = null;
  let htmlForHealth = "";

  if (fw === "static") {
    diagnostics = { ...diagnostics, previewStatus: "serving", buildStrategy: "static" };
    const index = input.files.find((f) => f.path === "index.html" || f.path.endsWith("/index.html"));
    let html = index?.content ?? "";
    html = injectPreviewShims(
      html.includes("<html") ? html : `<!DOCTYPE html><html><body>${html}</body></html>`,
      analysis.legacy,
    );
    const upload = await writeHtmlArtifact(input.admin, input.projectId, buildId, html);
    if (!upload.ok) {
      diagnostics = {
        ...diagnostics,
        previewStatus: "failed",
        blockedReason: upload.error,
        buildLogs: upload.error,
      };
    } else {
      artifactPath = upload.artifactPath;
      htmlForHealth = html;
      buildLogs = "static:index.html";
    }
  } else if (
    ["vite", "cra", "react", "lovable", "base44", "bolt", "v0"].includes(fw) &&
    canExecuteInlinePreviewBuild() &&
    analysis.framework.scripts.build
  ) {
    diagnostics = { ...diagnostics, previewStatus: "installing", buildStrategy: "vite_build" };
    const sandbox = await createImportSandbox(input.files, input.projectId);
    try {
      diagnostics = { ...diagnostics, previewStatus: "building" };
      const built = await tryNpmBuild(sandbox.rootDir, analysis.framework);
      buildLogs = built.logs;
      if (built.ok && built.outputDir) {
        diagnostics = { ...diagnostics, previewStatus: "serving", buildStrategy: "vite_build" };
        const upload = await uploadPreviewArtifacts({
          admin: input.admin,
          projectId: input.projectId,
          buildId,
          sourceDir: built.outputDir,
        });
        if (upload.ok) {
          artifactPath = upload.artifactPath;
          const indexPath = path.join(built.outputDir, "index.html");
          htmlForHealth = await fs.readFile(indexPath, "utf8");
          htmlForHealth = injectPreviewShims(htmlForHealth, analysis.legacy);
        } else {
          diagnostics = {
            ...diagnostics,
            previewStatus: "failed",
            blockedReason: upload.error,
          };
        }
      } else {
        diagnostics = {
          ...diagnostics,
          previewStatus: "building",
          buildStrategy: "static_snapshot",
          warnings: [
            ...diagnostics.warnings,
            "npm build failed — falling back to static snapshot preview",
          ],
        };
        const snap = buildStaticSnapshotHtml(input.files, input.projectId, analysis);
        buildLogs += `\n[fallback]\n${snap.logs}`;
        const upload = await writeHtmlArtifact(input.admin, input.projectId, buildId, snap.html);
        if (upload.ok) {
          artifactPath = upload.artifactPath;
          htmlForHealth = snap.html;
        } else {
          diagnostics.blockedReason = upload.error;
        }
      }
    } finally {
      await cleanupSandbox(sandbox.rootDir);
    }
  } else if (
    ["nextjs_app", "nextjs_pages", "base44", "lovable"].includes(fw) &&
    canExecuteInlinePreviewBuild() &&
    analysis.framework.scripts.build &&
    !analysis.framework.isSsrNext
  ) {
    diagnostics = { ...diagnostics, previewStatus: "building", buildStrategy: "next_build" };
    const sandbox = await createImportSandbox(input.files, input.projectId);
    try {
      const built = await tryNpmBuild(sandbox.rootDir, analysis.framework);
      buildLogs = built.logs;
      const outDir = built.outputDir ?? path.join(sandbox.rootDir, "out");
      if (built.ok) {
        const upload = await uploadPreviewArtifacts({
          admin: input.admin,
          projectId: input.projectId,
          buildId,
          sourceDir: outDir,
        });
        if (upload.ok) {
          artifactPath = upload.artifactPath;
          htmlForHealth = await fs.readFile(path.join(outDir, "index.html"), "utf8").catch(() => "");
          htmlForHealth = injectPreviewShims(htmlForHealth, analysis.legacy);
        }
      } else {
        diagnostics.warnings.push("Next build failed — using static snapshot");
      }
      if (!artifactPath) {
        const snap = buildStaticSnapshotHtml(input.files, input.projectId, analysis);
        buildLogs += `\n[fallback]\n${snap.logs}`;
        const upload = await writeHtmlArtifact(input.admin, input.projectId, buildId, snap.html);
        if (upload.ok) {
          artifactPath = upload.artifactPath;
          htmlForHealth = snap.html;
        }
      }
    } finally {
      await cleanupSandbox(sandbox.rootDir);
    }
  } else {
    diagnostics = {
      ...diagnostics,
      previewStatus: "building",
      buildStrategy: "static_snapshot",
    };
    const snap = buildStaticSnapshotHtml(input.files, input.projectId, analysis);
    buildLogs = snap.logs;
    const upload = await writeHtmlArtifact(input.admin, input.projectId, buildId, snap.html);
    if (upload.ok) {
      artifactPath = upload.artifactPath;
      htmlForHealth = snap.html;
    } else {
      diagnostics.blockedReason = upload.error;
    }
  }

  diagnostics = { ...diagnostics, previewStatus: "validating", buildLogs };

  const health = checkPreviewHealth(htmlForHealth, sourceFiles);
  const previewUrl = health.previewRenderable
    ? `${projectPreviewFrameUrl(input.projectId)}&artifact=${encodeURIComponent(buildId)}`
    : null;

  diagnostics = {
    ...diagnostics,
    previewStatus: health.previewRenderable ? "ready" : "failed",
    previewRenderable: health.previewRenderable,
    sourceIntegrityOk: health.sourceIntegrityOk,
    blockedReason: health.blockedReason,
    artifactPath,
    previewUrl,
    buildLogs: `${buildLogs}\n\n[health] ${health.errorMessage ?? "ok"}`,
    runtimeLogs: health.errorMessage ?? "",
    suggestedFixes: health.previewRenderable
      ? []
      : [
          health.blockedReason ?? "Preview validation failed",
          "Open build logs for details",
          canExecuteInlinePreviewBuild()
            ? "Retry rebuild from the import dashboard"
            : "Start the dedicated preview worker (npm run preview-worker:dev) or set PREVIEW_RUNTIME_BUILD=1 locally",
        ],
    lastPreviewBuildAt: new Date().toISOString(),
    jobId,
  };

  await db
    .from("preview_build_jobs")
    .update({
      status: health.previewRenderable ? "succeeded" : "failed",
      artifact_path: artifactPath,
      blocked_reason: diagnostics.blockedReason,
      build_logs: diagnostics.buildLogs?.slice(0, 50000),
      runtime_logs: diagnostics.runtimeLogs?.slice(0, 20000),
      preview_renderable: diagnostics.previewRenderable,
      source_integrity_ok: diagnostics.sourceIntegrityOk,
      diagnostics,
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  return { diagnostics, jobId };
}

export async function loadLatestPreviewDiagnostics(
  admin: SupabaseClient,
  projectId: string,
): Promise<ImportPreviewDiagnostics | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  const { data } = await db
    .from("preview_build_jobs")
    .select("diagnostics, preview_renderable, artifact_path, blocked_reason, build_logs, status, id, finished_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const d = (data.diagnostics ?? {}) as ImportPreviewDiagnostics;
  return {
    ...emptyImportDiagnostics(),
    ...d,
    previewRenderable: Boolean(data.preview_renderable),
    artifactPath: data.artifact_path ?? d.artifactPath,
    blockedReason: data.blocked_reason ?? d.blockedReason,
    buildLogs: data.build_logs ?? d.buildLogs,
    jobId: data.id,
    lastPreviewBuildAt: data.finished_at ?? d.lastPreviewBuildAt,
    previewStatus:
      data.status === "succeeded"
        ? "ready"
        : data.status === "failed"
          ? "failed"
          : data.status === "queued"
            ? "queued"
            : data.status === "running"
              ? "building"
              : d.previewStatus,
  };
}

export { PREVIEW_ARTIFACTS_BUCKET };
