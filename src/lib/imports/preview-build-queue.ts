import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  analyzeImportedProjectFiles,
  analysisToDiagnostics,
} from "@/lib/imports/analyze-imported-project";
import { uploadSourceSnapshot } from "@/lib/imports/preview-source-snapshot";
import type { ImportPreviewDiagnostics } from "@/lib/imports/import-diagnostics";
import type { ZipImportFile } from "@/lib/import/zip-file-validator";
import type { DetectedFrameworkId } from "@/lib/imports/framework-detector";
import { loadPreviewWorkerStatus } from "@/lib/preview/preview-worker-status";
import {
  mergeBillingIntoDiagnostics,
  type PreviewZipBillingDiagnostics,
} from "@/lib/imports/zip-preview-billing";

export function isServerlessHost(): boolean {
  return process.env.VERCEL === "1" || process.env.AWS_LAMBDA_FUNCTION_NAME != null;
}

export function canExecuteInlinePreviewBuild(): boolean {
  if (isServerlessHost()) return false;
  return process.env.PREVIEW_RUNTIME_BUILD === "1";
}

export function frameworkNeedsWorkerBuild(frameworkId: DetectedFrameworkId): boolean {
  if (frameworkId === "static") return false;
  return true;
}

export async function queuePreviewBuildJob(input: {
  admin: SupabaseClient;
  userId: string;
  projectId: string;
  files: ZipImportFile[];
  jobId?: string;
  previewBilling?: PreviewZipBillingDiagnostics;
}): Promise<{ diagnostics: ImportPreviewDiagnostics; jobId: string }> {
  const analysis = analyzeImportedProjectFiles(input.files);
  const jobId = input.jobId ?? crypto.randomUUID();
  const now = new Date().toISOString();

  let diagnostics = analysisToDiagnostics(analysis, {
    previewStatus: "queued",
    lastPreviewBuildAt: now,
    jobId,
  });

  const worker = await loadPreviewWorkerStatus();
  if (!worker.connected) {
    diagnostics = {
      ...diagnostics,
      previewStatus: "failed",
      previewRenderable: false,
      blockedReason:
        "Preview Worker Not Connected — deploy or start the preview worker before queueing ZIP builds.",
      buildLogs: "Worker heartbeat missing (90s threshold).",
    };
    return { diagnostics, jobId };
  }

  if (analysis.blockers.length > 0) {
    diagnostics = {
      ...diagnostics,
      previewStatus: "failed",
      previewRenderable: false,
      blockedReason: analysis.blockers[0] ?? "Import blocked",
      buildLogs: analysis.blockers.join("\n"),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (input.admin as any).from("preview_build_jobs").insert({
      id: jobId,
      project_id: input.projectId,
      owner_id: input.userId,
      status: "failed",
      framework: analysis.framework.id,
      blocked_reason: diagnostics.blockedReason,
      build_logs: diagnostics.buildLogs,
      logs: diagnostics.buildLogs,
      diagnostics,
      preview_renderable: false,
      finished_at: now,
      updated_at: now,
      created_at: now,
    });
    return { diagnostics, jobId };
  }

  const snapshot = await uploadSourceSnapshot({
    admin: input.admin,
    projectId: input.projectId,
    jobId,
    files: input.files,
  });

  if (!snapshot.ok) {
    diagnostics = {
      ...diagnostics,
      previewStatus: "failed",
      previewRenderable: false,
      blockedReason: snapshot.error,
      buildLogs: snapshot.error,
    };
    return { diagnostics, jobId };
  }

  diagnostics = {
    ...diagnostics,
    previewStatus: "queued",
    previewRenderable: false,
    blockedReason: null,
    buildStrategy: "queued_worker",
    warnings: [
      ...diagnostics.warnings,
      "Preview build queued for dedicated worker — npm install/build does not run on Vercel serverless.",
    ],
    suggestedFixes: [
      "Start the preview worker (npm run preview-worker:dev) or deploy worker/preview-worker to Railway/Render.",
    ],
  };

  const diagnosticsWithBilling = input.previewBilling
    ? (mergeBillingIntoDiagnostics(
        diagnostics as unknown as Record<string, unknown>,
        input.previewBilling,
      ) as typeof diagnostics)
    : diagnostics;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (input.admin as any).from("preview_build_jobs").insert({
    id: jobId,
    project_id: input.projectId,
    owner_id: input.userId,
    status: "queued",
    framework: analysis.framework.id,
    build_strategy: "queued_worker",
    source_snapshot_path: snapshot.sourceSnapshotPath,
    runtime_mode: analysis.framework.isSsrNext ? "ssr_blocked" : "static_or_spa",
    diagnostics: diagnosticsWithBilling,
    preview_renderable: false,
    source_integrity_ok: false,
    created_at: now,
    updated_at: now,
  });

  return { diagnostics, jobId };
}
