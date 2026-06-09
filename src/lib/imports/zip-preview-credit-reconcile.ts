import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  captureZipPreviewActionCredits,
  refundZipPreviewActionCredits,
  zipPreviewOperationId,
} from "@/lib/imports/zip-preview-action-credits";
import {
  loadZipPreviewHoldStatus,
  patchLatestPreviewJobBilling,
  previewZipBillingDiagnostics,
} from "@/lib/imports/zip-preview-billing";

export type ZipPreviewCreditReconcileResult = {
  action: "captured" | "released" | "none" | "capture_failed";
  charged: number;
  warning: string | null;
};

/** Capture reserved credits after worker success, or release on terminal failure. */
export async function reconcileZipPreviewCreditCapture(input: {
  projectId: string;
  ownerId: string;
  jobStatus: string | null;
  previewRenderable: boolean;
  admin?: SupabaseClient | null;
}): Promise<ZipPreviewCreditReconcileResult> {
  const hold = await loadZipPreviewHoldStatus(input.projectId);
  if (!hold) return { action: "none", charged: 0, warning: null };

  const operationId = zipPreviewOperationId(input.projectId);
  const admin = input.admin ?? createSupabaseAdmin();

  if (
    input.previewRenderable &&
    (input.jobStatus === "succeeded" || input.jobStatus === "ready") &&
    hold.status === "reserved"
  ) {
    const capture = await captureZipPreviewActionCredits({
      userId: input.ownerId,
      projectId: input.projectId,
    });
    if (capture.ok && capture.charged > 0) {
      if (admin) {
        await patchJobCreditMetadata(admin, input.projectId, {
          credit_reservation_id: operationId,
          estimated_action_credits: hold.credits,
          captured_action_credits: capture.charged,
          credit_status: "captured",
        });
      }
      return { action: "captured", charged: capture.charged, warning: null };
    }

    const warning =
      "Preview is ready but Action Credit capture failed — check billing diagnostics.";
    if (admin) {
      await patchJobCreditMetadata(admin, input.projectId, {
        credit_reservation_id: operationId,
        estimated_action_credits: hold.credits,
        captured_action_credits: null,
        credit_status: "reserved",
        credit_capture_error: warning,
      });
    }
    return { action: "capture_failed", charged: 0, warning };
  }

  if (
    (input.jobStatus === "failed" || input.jobStatus === "failed_stale") &&
    hold.status === "reserved"
  ) {
    await refundZipPreviewActionCredits({
      userId: input.ownerId,
      projectId: input.projectId,
      reason: "preview_build_failed",
    });
    if (admin) {
      await patchJobCreditMetadata(admin, input.projectId, {
        credit_reservation_id: operationId,
        estimated_action_credits: hold.credits,
        captured_action_credits: null,
        credit_status: "released",
      });
    }
    return { action: "released", charged: 0, warning: null };
  }

  return { action: "none", charged: 0, warning: null };
}

async function patchJobCreditMetadata(
  admin: SupabaseClient,
  projectId: string,
  credit: Record<string, unknown>,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  const { data: job } = await db
    .from("preview_build_jobs")
    .select("id, diagnostics")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!job?.id) return;

  const prev =
    job.diagnostics && typeof job.diagnostics === "object" && !Array.isArray(job.diagnostics)
      ? (job.diagnostics as Record<string, unknown>)
      : {};

  const estimated = Number(credit.estimated_action_credits ?? prev.estimated_action_credits ?? 0);
  const billing = previewZipBillingDiagnostics(
    { estimatedActionCredits: estimated },
    String(credit.credit_status ?? "none"),
    credit.captured_action_credits != null ? Number(credit.captured_action_credits) : null,
  );

  await db
    .from("preview_build_jobs")
    .update({
      diagnostics: {
        ...prev,
        ...credit,
        ...billing,
        previewBilling: billing,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);
}
