import { randomUUID } from "node:crypto";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { monthlyTokensForPlan, normalizePlanId } from "@/lib/billing/plans";
import { monthlyActionCreditsForPlan } from "@/lib/action-credits/action-credit-allowances";
import { billablePlanToPlanId, type BillablePlanId } from "@/lib/billing/plan-billing-catalog";
import { batchUserLevelActionBalances } from "@/lib/admin/batch-action-balances";

export type BillingAttemptSnapshot = {
  plan_id: string;
  build_credits: number;
  action_credits: number;
  period_end: string | null;
  paddle_subscription_id: string | null;
};

export type BillingAttemptTrace = {
  billing_attempt_id: string;
  user_id: string;
  current_plan_before: string;
  target_plan: string;
  target_storage_plan: string;
  current_build_credits_before: number;
  current_action_credits_before: number;
  target_build_credits_expected: number;
  target_action_credits_expected: number;
  current_period_end_before: string | null;
  endpoint_called: string | null;
  resolved_action: string | null;
  paddle_transaction_id: string | null;
  paddle_subscription_id: string | null;
  paddle_price_id: string | null;
  webhook_received: boolean;
  webhook_verified: boolean;
  webhook_event_type: string | null;
  webhook_processing_status: string | null;
  entitlement_apply_started: boolean;
  entitlement_apply_completed: boolean;
  plan_after: string | null;
  build_credits_after: number | null;
  action_credits_after: number | null;
  period_start_after: string | null;
  period_end_after: string | null;
  failure_code: string | null;
  failure_message: string | null;
  created_at: string;
  updated_at: string;
};

function attemptEventId(attemptId: string): string {
  return `paddle:attempt:${attemptId}`;
}

export async function captureBillingSnapshot(
  userId: string,
): Promise<BillingAttemptSnapshot> {
  const admin = createSupabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("plan_id, credits_remaining, credits_reset_at, paddle_subscription_id")
    .eq("id", userId)
    .maybeSingle();

  const actionMap = await batchUserLevelActionBalances(admin, [userId]);
  const planId = normalizePlanId(profile?.plan_id ?? "free");

  let periodEnd: string | null = profile?.credits_reset_at ?? null;
  const subId = profile?.paddle_subscription_id ?? null;
  if (subId) {
    const { data: sub } = await admin
      .from("subscriptions")
      .select("current_period_end")
      .eq("stripe_subscription_id", subId)
      .maybeSingle();
    if (sub?.current_period_end) periodEnd = sub.current_period_end;
  }

  return {
    plan_id: planId,
    build_credits: typeof profile?.credits_remaining === "number" ? profile.credits_remaining : 0,
    action_credits: actionMap.get(userId) ?? monthlyActionCreditsForPlan(planId),
    period_end: periodEnd,
    paddle_subscription_id: subId,
  };
}

export async function createBillingAttempt(input: {
  userId: string;
  targetPlan: BillablePlanId;
  endpointCalled: string;
  resolvedAction: string;
  before: BillingAttemptSnapshot;
}): Promise<string> {
  const attemptId = randomUUID();
  const admin = createSupabaseAdmin();
  const targetStorage = billablePlanToPlanId(input.targetPlan);
  const now = new Date().toISOString();

  const trace: BillingAttemptTrace = {
    billing_attempt_id: attemptId,
    user_id: input.userId,
    current_plan_before: input.before.plan_id,
    target_plan: input.targetPlan,
    target_storage_plan: targetStorage,
    current_build_credits_before: input.before.build_credits,
    current_action_credits_before: input.before.action_credits,
    target_build_credits_expected: monthlyTokensForPlan(targetStorage),
    target_action_credits_expected: monthlyActionCreditsForPlan(targetStorage),
    current_period_end_before: input.before.period_end,
    endpoint_called: input.endpointCalled,
    resolved_action: input.resolvedAction,
    paddle_transaction_id: null,
    paddle_subscription_id: input.before.paddle_subscription_id,
    paddle_price_id: null,
    webhook_received: false,
    webhook_verified: false,
    webhook_event_type: null,
    webhook_processing_status: null,
    entitlement_apply_started: false,
    entitlement_apply_completed: false,
    plan_after: null,
    build_credits_after: null,
    action_credits_after: null,
    period_start_after: null,
    period_end_after: null,
    failure_code: null,
    failure_message: null,
    created_at: now,
    updated_at: now,
  };

  await admin.from("billing_events").insert({
    user_id: input.userId,
    stripe_event_id: attemptEventId(attemptId),
    event_type: "paddle.billing.attempt",
    metadata: { provider: "paddle", trace },
  } as never);

  return attemptId;
}

export async function patchBillingAttempt(
  attemptId: string,
  patch: Partial<BillingAttemptTrace>,
): Promise<void> {
  const admin = createSupabaseAdmin();
  const { data: row } = await admin
    .from("billing_events")
    .select("metadata")
    .eq("stripe_event_id", attemptEventId(attemptId))
    .maybeSingle();

  const meta = (row?.metadata ?? {}) as Record<string, unknown>;
  const prev = (meta.trace ?? {}) as BillingAttemptTrace;
  const next: BillingAttemptTrace = {
    ...prev,
    ...patch,
    billing_attempt_id: attemptId,
    updated_at: new Date().toISOString(),
  };

  await admin
    .from("billing_events")
    .update({ metadata: { ...meta, trace: next } } as never)
    .eq("stripe_event_id", attemptEventId(attemptId));
}

export async function loadBillingAttemptTrace(
  attemptId: string,
): Promise<BillingAttemptTrace | null> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("billing_events")
    .select("metadata")
    .eq("stripe_event_id", attemptEventId(attemptId))
    .maybeSingle();

  const meta = (data?.metadata ?? {}) as Record<string, unknown>;
  const trace = meta.trace as BillingAttemptTrace | undefined;
  return trace ?? null;
}

/** Find attempt id from webhook / paddle metadata. */
export function readBillingAttemptIdFromCustom(
  custom: Record<string, unknown> | null | undefined,
): string | null {
  if (!custom) return null;
  const id = custom.billing_attempt_id ?? custom.billingAttemptId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

/** Link Paddle webhook processing to a billing attempt trace row. */
export async function touchBillingAttemptWebhook(
  attemptId: string | null | undefined,
  patch: Partial<
    Pick<
      BillingAttemptTrace,
      | "webhook_received"
      | "webhook_verified"
      | "webhook_event_type"
      | "webhook_processing_status"
      | "paddle_transaction_id"
      | "paddle_subscription_id"
      | "paddle_price_id"
      | "failure_code"
      | "failure_message"
      | "entitlement_apply_started"
      | "entitlement_apply_completed"
      | "plan_after"
      | "build_credits_after"
      | "action_credits_after"
      | "period_start_after"
      | "period_end_after"
    >
  >,
): Promise<void> {
  if (!attemptId) return;
  await patchBillingAttempt(attemptId, {
    webhook_received: true,
    ...patch,
  });
}

export async function finalizeBillingAttemptEntitlement(
  attemptId: string | null | undefined,
  input: {
    userId: string;
    applied: boolean;
    failureCode?: string | null;
    failureMessage?: string | null;
  },
): Promise<void> {
  if (!attemptId) return;
  const after = await captureBillingSnapshot(input.userId);
  await patchBillingAttempt(attemptId, {
    entitlement_apply_completed: input.applied,
    plan_after: after.plan_id,
    build_credits_after: after.build_credits,
    action_credits_after: after.action_credits,
    period_end_after: after.period_end,
    failure_code: input.applied ? null : (input.failureCode ?? "entitlement_not_started"),
    failure_message: input.applied ? null : (input.failureMessage ?? "Entitlement did not apply"),
  });
}
