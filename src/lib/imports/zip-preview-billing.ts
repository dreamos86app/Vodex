import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  zipPreviewOperationId,
  type ZipPreviewCreditEstimate,
} from "@/lib/imports/zip-preview-action-credits";

export type ZipPreviewChargeStatus = "pending" | "charged" | "refunded" | "cancelled" | "none";

export type PreviewZipBillingDiagnostics = {
  estimated_action_credits: number;
  charged_action_credits: number | null;
  charge_status: ZipPreviewChargeStatus;
};

export function previewZipBillingDiagnostics(
  estimate: Pick<ZipPreviewCreditEstimate, "estimatedActionCredits">,
  holdStatus: string | null | undefined,
  chargedCredits?: number | null,
): PreviewZipBillingDiagnostics {
  const status = normalizeHoldStatus(holdStatus);
  return {
    estimated_action_credits: estimate.estimatedActionCredits,
    charged_action_credits:
      status === "charged" ? (chargedCredits ?? estimate.estimatedActionCredits) : null,
    charge_status: status,
  };
}

function normalizeHoldStatus(raw: string | null | undefined): ZipPreviewChargeStatus {
  if (!raw || raw === "none") return "none";
  if (raw === "reserved") return "pending";
  if (raw === "charged" || raw === "refunded" || raw === "cancelled") return raw;
  return "none";
}

export function mergeBillingIntoDiagnostics(
  diagnostics: Record<string, unknown>,
  billing: PreviewZipBillingDiagnostics,
): Record<string, unknown> {
  return {
    ...diagnostics,
    ...billing,
    previewBilling: billing,
  };
}

export async function loadZipPreviewHoldStatus(
  projectId: string,
): Promise<{ status: string; credits: number } | null> {
  const admin = createSupabaseAdmin();
  if (!admin) return null;
  const operationId = zipPreviewOperationId(projectId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from("zip_preview_action_holds")
    .select("status, credits")
    .eq("operation_id", operationId)
    .maybeSingle();
  if (!data) return null;
  return { status: String(data.status), credits: Number(data.credits) || 0 };
}

export async function loadZipPreviewBillingForProject(
  projectId: string,
  fallbackEstimate?: number,
): Promise<PreviewZipBillingDiagnostics> {
  const hold = await loadZipPreviewHoldStatus(projectId);
  const estimated = hold?.credits ?? fallbackEstimate ?? 0;
  return previewZipBillingDiagnostics(
    { estimatedActionCredits: estimated },
    hold?.status,
    hold?.status === "charged" ? hold.credits : null,
  );
}

export async function patchLatestPreviewJobBilling(
  admin: SupabaseClient,
  projectId: string,
  billing: PreviewZipBillingDiagnostics,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: job } = await (admin as any)
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin as any)
    .from("preview_build_jobs")
    .update({
      diagnostics: mergeBillingIntoDiagnostics(prev, billing),
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);
}
