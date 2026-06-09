import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  analyzeImportedProjectFiles,
  analysisToDiagnostics,
} from "@/lib/imports/analyze-imported-project";
import { uploadSourceSnapshot } from "@/lib/imports/preview-source-snapshot";
import { ensureNextStaticExportInFiles } from "@/lib/imports/next-static-export-repair";
import type { ImportPreviewDiagnostics } from "@/lib/imports/import-diagnostics";
import type { ZipImportFile } from "@/lib/import/zip-file-validator";
import type { DetectedFrameworkId } from "@/lib/imports/framework-detector";
import { loadPreviewWorkerStatus } from "@/lib/preview/preview-worker-status";
import {
  mergeBillingIntoDiagnostics,
  previewZipBillingDiagnostics,
  type PreviewZipBillingDiagnostics,
} from "@/lib/imports/zip-preview-billing";
import { zipPreviewOperationId } from "@/lib/imports/zip-preview-action-credits";

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
  let queueFiles = input.files;
  if (analysis.framework.isSsrNext) {
    const patched = ensureNextStaticExportInFiles(queueFiles);
    queueFiles = patched.files;
  }
  const jobId = input.jobId ?? crypto.randomUUID();
  const now = new Date().toISOString();

  // Mark prior failed preview jobs as superseded when a new build is queued after auto-repair.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminJobs = input.admin as any;
  const { data: priorFailed } = await adminJobs
    .from("preview_build_jobs")
    .select("id, diagnostics")
    .eq("project_id", input.projectId)
    .eq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(5);
  for (const prior of priorFailed ?? []) {
    const prevDiag =
      prior.diagnostics && typeof prior.diagnostics === "object"
        ? (prior.diagnostics as Record<string, unknown>)
        : {};
    await adminJobs
      .from("preview_build_jobs")
      .update({
        diagnostics: {
          ...prevDiag,
          superseded_by: jobId,
          superseded_at: now,
          superseded_reason: "auto_repair_rebuild",
        },
        updated_at: now,
      })
      .eq("id", prior.id);
  }

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
    files: queueFiles,
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

  const operationId = zipPreviewOperationId(input.projectId);
  const creditMeta = input.previewBilling
    ? {
        credit_reservation_id: operationId,
        estimated_action_credits: input.previewBilling.estimated_action_credits,
        captured_action_credits: null,
        credit_status: "reserved" as const,
      }
    : {
        credit_reservation_id: operationId,
        estimated_action_credits: 0,
        captured_action_credits: null,
        credit_status: "not_charged" as const,
      };

  const billingPayload =
    input.previewBilling ??
    previewZipBillingDiagnostics({ estimatedActionCredits: 0 }, "none");

  const diagnosticsWithBilling = mergeBillingIntoDiagnostics(
    { ...(diagnostics as unknown as Record<string, unknown>), ...creditMeta },
    billingPayload,
  ) as typeof diagnostics;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (input.admin as any).from("preview_build_jobs").insert({
    id: jobId,
    project_id: input.projectId,
    owner_id: input.userId,
    status: "queued",
    framework: analysis.framework.id,
    build_strategy: "queued_worker",
    source_snapshot_path: snapshot.sourceSnapshotPath,
    runtime_mode: analysis.framework.isSsrNext ? "static_export_patched" : "static_or_spa",
    diagnostics: diagnosticsWithBilling,
    preview_renderable: false,
    source_integrity_ok: false,
    created_at: now,
    updated_at: now,
  });

  return { diagnostics, jobId };
}
