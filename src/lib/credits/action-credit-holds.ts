import "server-only";

import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { assertActionCreditsAffordable } from "@/lib/action-credits/assert-action-credits-affordable";
import { chargeActionCredit } from "@/lib/action-credits/charge-action-credit";
import { refundActionCredit } from "@/lib/action-credits/refund-action-credit";

export type ActionCreditHoldStatus = "reserved" | "charged" | "released" | "failed";

export type ActionCreditHold = {
  operationId: string;
  userId: string;
  projectId: string;
  actionType: string;
  amount: number;
  status: ActionCreditHoldStatus;
};

/** Reserve credits before an action — charge only via commitActionCreditHold on success. */
export async function reserveActionCreditHold(input: {
  userId: string;
  projectId: string;
  actionType: string;
  amount: number;
  operationId: string;
  meta?: Record<string, unknown>;
}): Promise<{ ok: true } | { ok: false; error: string; code: string }> {
  const affordable = await assertActionCreditsAffordable({
    ownerUserId: input.userId,
    projectId: input.projectId,
    actionType: input.actionType,
    dynamicFloor: input.amount,
  });
  if (!affordable.ok) {
    return { ok: false, error: "Not enough Action Credits.", code: "insufficient" };
  }

  return { ok: true };
}

export async function commitActionCreditHold(input: {
  userId: string;
  projectId: string;
  actionType: string;
  amount: number;
  operationId: string;
  reason: string;
}): Promise<{ ok: boolean; charged?: number }> {
  const result = await chargeActionCredit({
    ownerUserId: input.userId,
    projectId: input.projectId,
    actionType: input.actionType,
    dynamicFloor: input.amount,
    operationId: input.operationId,
    metadata: { reason: input.reason },
  });

  const admin = createSupabaseAdmin();
  if (admin && result.ok) {
    await admin
      .from("zip_preview_action_holds" as never)
      .update({ status: "charged", updated_at: new Date().toISOString() } as never)
      .eq("operation_id", input.operationId);
  }

  return result.ok ? { ok: true, charged: result.charged } : { ok: false };
}

export async function releaseActionCreditHold(input: {
  userId: string;
  projectId: string;
  operationId: string;
  reason: string;
}): Promise<void> {
  const admin = createSupabaseAdmin();
  let holdStatus: string | null = null;
  if (admin) {
    const { data: hold } = await admin
      .from("zip_preview_action_holds" as never)
      .select("status" as never)
      .eq("operation_id" as never, input.operationId)
      .maybeSingle();
    holdStatus = (hold as { status?: string } | null)?.status ?? null;
  }

  if (holdStatus === "charged") {
    await refundActionCredit({
      ownerUserId: input.userId,
      projectId: input.projectId,
      operationId: input.operationId,
      reason: input.reason,
    });
  }

  if (admin) {
    const nextStatus = holdStatus === "charged" ? "refunded" : "cancelled";
    await admin
      .from("zip_preview_action_holds" as never)
      .update({ status: nextStatus, updated_at: new Date().toISOString() } as never)
      .eq("operation_id" as never, input.operationId);
  }
}
