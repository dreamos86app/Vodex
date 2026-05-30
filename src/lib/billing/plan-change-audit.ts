import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { PlanChangeBillingIntent, PlanChangeSource } from "@/lib/billing/plan-change-router";

export async function logPlanChangeAttempt(input: {
  userId: string;
  previousPlan: string;
  targetPlan: string;
  targetInterval: string;
  billingIntent: PlanChangeBillingIntent;
  source: PlanChangeSource;
  action: string;
  transactionId?: string | null;
  subscriptionId?: string | null;
  eventId?: string | null;
  blockedReason?: string | null;
}): Promise<void> {
  const admin = createSupabaseAdmin();
  const id = `paddle:plan_change:${input.userId}:${Date.now()}`;
  await admin.from("billing_events").insert({
    user_id: input.userId,
    stripe_event_id: id,
    event_type: "paddle.plan_change.attempt",
    stripe_subscription_id: input.subscriptionId ?? null,
    metadata: {
      provider: "paddle",
      previous_plan: input.previousPlan,
      target_plan: input.targetPlan,
      target_interval: input.targetInterval,
      billing_intent: input.billingIntent,
      source: input.source,
      action: input.action,
      transaction_id: input.transactionId ?? null,
      paddle_event_id: input.eventId ?? null,
      blocked_reason: input.blockedReason ?? null,
      received_at: new Date().toISOString(),
    },
  } as never);
}
