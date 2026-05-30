import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function logPaddleEntitlementAudit(input: {
  userId: string;
  previousPlan: string;
  newPlan: string;
  buildCreditsBefore: number | null;
  buildCreditsAfter: number;
  actionCreditsAfter: number;
  paddleEventId?: string | null;
  paddleTransactionId?: string | null;
  paddleSubscriptionId?: string | null;
  paddlePriceId?: string | null;
  source: string;
  idempotencyKey: string;
}): Promise<void> {
  const admin = createSupabaseAdmin();
  const auditId = `paddle:entitlement:${input.idempotencyKey}`;
  const { error } = await admin.from("billing_events").insert({
    user_id: input.userId,
    stripe_event_id: auditId,
    event_type: "paddle.entitlement.applied",
    stripe_subscription_id: input.paddleSubscriptionId ?? null,
    metadata: {
      provider: "paddle",
      reason: "paddle_webhook",
      previous_plan: input.previousPlan,
      new_plan: input.newPlan,
      credits_before: input.buildCreditsBefore,
      credits_after: input.buildCreditsAfter,
      action_credits_after: input.actionCreditsAfter,
      paddle_event_id: input.paddleEventId ?? null,
      paddle_transaction_id: input.paddleTransactionId ?? null,
      paddle_price_id: input.paddlePriceId ?? null,
      source: input.source,
      processed_at: new Date().toISOString(),
    },
  } as never);

  if (error && String(error.code) !== "23505") {
    console.warn("[paddle-entitlement] audit log failed:", error.message);
  }
}
