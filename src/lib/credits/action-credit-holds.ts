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

  const admin = createSupabaseAdmin();
  if (!admin) return { ok: false, error: "Service unavailable", code: "unavailable" };

  const { error } = await (admin as never as { from: (t: string) => { upsert: (v: unknown) => Promise<{ error: { message: string } | null }> } })
    .from("zip_preview_action_holds")
    .upsert({
      operation_id: input.operationId,
      user_id: input.userId,
      project_id: input.projectId,
      status: "reserved",
      estimated_credits: input.amount,
      meta: input.meta ?? {},
      updated_at: new Date().toISOString(),
    });

  if (error) return { ok: false, error: error.message, code: "db_error" };
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
  await refundActionCredit({
    ownerUserId: input.userId,
    projectId: input.projectId,
    operationId: input.operationId,
    reason: input.reason,
  });

  const admin = createSupabaseAdmin();
  if (admin) {
    await admin
      .from("zip_preview_action_holds" as never)
      .update({ status: "released", updated_at: new Date().toISOString() } as never)
      .eq("operation_id", input.operationId);
  }
}
