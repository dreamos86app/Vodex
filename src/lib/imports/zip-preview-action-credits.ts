import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  commitActionCreditHold,
  releaseActionCreditHold,
  reserveActionCreditHold,
} from "@/lib/credits/action-credit-holds";
import { getPreviewCostMultiplier } from "@/lib/platform/platform-settings";
import { patchLatestPreviewJobBilling, previewZipBillingDiagnostics } from "@/lib/imports/zip-preview-billing";

export type ZipPreviewCreditTier = 1 | 2 | 3 | 4;

export type ZipPreviewCreditEstimate = {
  tier: ZipPreviewCreditTier;
  baseCredits: number;
  multiplier: number;
  /** Tier base × platform multiplier (ZIP size only). */
  sizeBaseCredits: number;
  dependencyCount: number;
  dependencySurchargeCredits: number;
  estimatedActionCredits: number;
  estimatedFiles: number;
  estimatedSizeMb: number;
  framework: string;
  frameworkLabel: string;
};

/** Extra Action Credits for large dependency graphs (additive, not multiplied). */
export function dependencySurchargeCredits(dependencyCount: number): number {
  if (dependencyCount > 400) return 100;
  if (dependencyCount > 200) return 50;
  if (dependencyCount > 100) return 25;
  return 0;
}

const TIER_BASE: Record<ZipPreviewCreditTier, number> = {
  1: 10,
  2: 25,
  3: 50,
  4: 100,
};

export function tierForSizeMb(sizeMb: number): ZipPreviewCreditTier {
  if (sizeMb < 5) return 1;
  if (sizeMb < 25) return 2;
  if (sizeMb < 100) return 3;
  return 4;
}

export function estimateZipPreviewCredits(input: {
  sizeBytes: number;
  fileCount: number;
  frameworkId: string;
  frameworkLabel?: string;
  multiplier?: number;
  dependencyCount?: number;
}): ZipPreviewCreditEstimate {
  const estimatedSizeMb = Math.max(0.01, input.sizeBytes / (1024 * 1024));
  const tier = tierForSizeMb(estimatedSizeMb);
  const baseCredits = TIER_BASE[tier];
  const multiplier = input.multiplier ?? 1;
  const sizeBaseCredits = Math.ceil(baseCredits * multiplier);
  const dependencyCount = Math.max(0, input.dependencyCount ?? 0);
  const dependencySurcharge = dependencySurchargeCredits(dependencyCount);
  const estimatedActionCredits = sizeBaseCredits + dependencySurcharge;

  return {
    tier,
    baseCredits,
    multiplier,
    sizeBaseCredits,
    dependencyCount,
    dependencySurchargeCredits: dependencySurcharge,
    estimatedActionCredits,
    estimatedFiles: input.fileCount,
    estimatedSizeMb: Math.round(estimatedSizeMb * 10) / 10,
    framework: input.frameworkId,
    frameworkLabel:
      input.frameworkLabel ??
      (input.frameworkId === "vite"
        ? "Vite React"
        : input.frameworkId === "nextjs"
          ? "Next.js"
          : input.frameworkId),
  };
}

export async function estimateZipPreviewCreditsWithPlatformMultiplier(
  input: Omit<Parameters<typeof estimateZipPreviewCredits>[0], "multiplier">,
): Promise<ZipPreviewCreditEstimate> {
  const multiplier = await getPreviewCostMultiplier();
  return estimateZipPreviewCredits({ ...input, multiplier });
}

export function zipPreviewOperationId(projectId: string): string {
  return `zip-preview:${projectId}`;
}

/** Reserve hold row + verify balance — charge happens after successful worker build. */
export async function reserveZipPreviewActionCredits(input: {
  userId: string;
  projectId: string;
  estimate: ZipPreviewCreditEstimate;
}): Promise<
  | { ok: true; operationId: string; credits: number }
  | { ok: false; error: string; code: "insufficient" | "db_error" }
> {
  const operationId = zipPreviewOperationId(input.projectId);
  const reserved = await reserveActionCreditHold({
    userId: input.userId,
    projectId: input.projectId,
    actionType: "zip_preview_build",
    amount: input.estimate.estimatedActionCredits,
    operationId,
    meta: {
      tier: input.estimate.tier,
      size_mb: input.estimate.estimatedSizeMb,
      framework: input.estimate.framework,
    },
  });
  if (!reserved.ok) {
    return {
      ok: false,
      error: reserved.code === "insufficient" ? "Not enough Action Credits for this ZIP preview build." : reserved.error,
      code: reserved.code === "insufficient" ? "insufficient" : "db_error",
    };
  }

  const admin = createSupabaseAdmin();
  if (admin) {
    await (admin as never as { from: (t: string) => { upsert: (v: unknown) => Promise<unknown> } })
      .from("zip_preview_action_holds")
      .upsert({
        user_id: input.userId,
        project_id: input.projectId,
        operation_id: operationId,
        credits: input.estimate.estimatedActionCredits,
        status: "reserved",
        tier: input.estimate.tier,
        size_mb: input.estimate.estimatedSizeMb,
        framework: input.estimate.framework,
        metadata: {
          base_credits: input.estimate.baseCredits,
          multiplier: input.estimate.multiplier,
        },
        updated_at: new Date().toISOString(),
      });
  }

  return { ok: true, operationId, credits: input.estimate.estimatedActionCredits };
}

export async function captureZipPreviewActionCredits(input: {
  userId: string;
  projectId: string;
}): Promise<{ ok: boolean; charged: number }> {
  const admin = createSupabaseAdmin();
  if (!admin) return { ok: false, charged: 0 };

  const operationId = zipPreviewOperationId(input.projectId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: hold } = await (admin as any)
    .from("zip_preview_action_holds")
    .select("credits, status")
    .eq("operation_id", operationId)
    .maybeSingle();

  if (!hold || hold.status === "charged") return { ok: true, charged: 0 };
  if (hold.status === "refunded" || hold.status === "cancelled") return { ok: false, charged: 0 };

  const credits = Number(hold.credits) || 0;
  const charge = await commitActionCreditHold({
    userId: input.userId,
    projectId: input.projectId,
    actionType: "zip_preview_build",
    amount: credits,
    operationId,
    reason: "zip_preview_success",
  });

  if (!charge.ok) return { ok: false, charged: 0 };

  await patchLatestPreviewJobBilling(
    admin,
    input.projectId,
    previewZipBillingDiagnostics({ estimatedActionCredits: credits }, "charged", charge.charged ?? credits),
  );

  return { ok: true, charged: charge.charged ?? credits };
}

export async function refundZipPreviewActionCredits(input: {
  userId: string;
  projectId: string;
  reason?: string;
}): Promise<{ ok: boolean; refunded: number }> {
  const admin = createSupabaseAdmin();
  if (!admin) return { ok: false, refunded: 0 };

  const operationId = zipPreviewOperationId(input.projectId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: hold } = await (admin as any)
    .from("zip_preview_action_holds")
    .select("status, credits")
    .eq("operation_id", operationId)
    .maybeSingle();

  if (!hold) return { ok: true, refunded: 0 };
  const holdCredits = Number(hold.credits) || 0;
  await releaseActionCreditHold({
    userId: input.userId,
    projectId: input.projectId,
    operationId,
    reason: input.reason ?? "zip_preview_failed",
  });

  if (hold.status === "charged") {
    await patchLatestPreviewJobBilling(
      admin,
      input.projectId,
      previewZipBillingDiagnostics({ estimatedActionCredits: holdCredits }, "refunded"),
    );
    return { ok: true, refunded: holdCredits };
  }

  if (hold.status === "reserved") {
    await patchLatestPreviewJobBilling(
      admin,
      input.projectId,
      previewZipBillingDiagnostics({ estimatedActionCredits: holdCredits }, "cancelled"),
    );
    return { ok: true, refunded: 0 };
  }

  return { ok: true, refunded: 0 };
}
