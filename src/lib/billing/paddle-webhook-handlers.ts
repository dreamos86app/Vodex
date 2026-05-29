import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { syncPlanCreditsForUser } from "@/lib/billing/sync-plan-credits";
import { applyImmediatePlanUpgrade } from "@/lib/billing/apply-immediate-plan-upgrade";
import { claimBillingEvent } from "@/lib/billing/billing-event-idempotency";
import { normalizePlanId } from "@/lib/billing/plans";
import type { BillingInterval } from "@/lib/billing/upgrade-policy";
import type { PlanId } from "@/lib/supabase/types";

function planFromPaddlePrice(priceId: string | undefined): PlanId {
  if (!priceId) return "free";
  if (priceId === process.env.PADDLE_STARTER_PRICE_ID?.trim()) return "starter";
  if (priceId === process.env.PADDLE_PRO_PRICE_ID?.trim()) return "pro";
  if (priceId === process.env.PADDLE_INFINITY_PRICE_ID?.trim()) return "infinity";
  return "pro";
}

function periodEndFromEvent(data: Record<string, unknown>): string {
  const end = data.current_billing_period as { ends_at?: string } | undefined;
  if (end?.ends_at) return end.ends_at;
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
}

function readCustomData(data: Record<string, unknown>): {
  userId?: string;
  planId?: string;
  billingIntent?: string;
  billingInterval?: BillingInterval;
} {
  const custom = (data.custom_data ?? {}) as Record<string, string>;
  return {
    userId: custom.user_id,
    planId: custom.plan_id,
    billingIntent: custom.billing_intent,
    billingInterval: custom.billing_interval === "yearly" ? "yearly" : "monthly",
  };
}

async function upsertPaddleSubscriptionRow(input: {
  userId: string;
  subscriptionId: string;
  planId: PlanId;
  periodEnd: string;
  status: string;
}): Promise<void> {
  const admin = createSupabaseAdmin();
  const now = new Date().toISOString();
  await admin.from("subscriptions").upsert(
    {
      user_id: input.userId,
      stripe_subscription_id: input.subscriptionId,
      plan_id: input.planId,
      status: input.status === "trialing" ? "trialing" : "active",
      current_period_start: now,
      current_period_end: input.periodEnd,
      credits_per_period: 0,
    } as never,
    { onConflict: "stripe_subscription_id" },
  );

  await admin
    .from("profiles")
    .update({ stripe_subscription_id: input.subscriptionId, plan_id: input.planId })
    .eq("id", input.userId);
}

/** Grant credits only after confirmed payment (transaction.completed). */
export async function handlePaddleTransactionCompleted(input: {
  data: Record<string, unknown>;
  paddleEventId: string;
}): Promise<void> {
  const status = String(input.data.status ?? "");
  if (status !== "completed" && status !== "paid") return;

  const custom = readCustomData(input.data);
  const userId = custom.userId;
  if (!userId) return;

  const priceId =
    (input.data.items as Array<{ price?: { id?: string } }> | undefined)?.[0]?.price?.id ??
    (input.data.price_id as string | undefined);
  const newPlan = normalizePlanId(custom.planId ?? planFromPaddlePrice(priceId));
  const interval = custom.billingInterval ?? "monthly";
  const subscriptionId = String(
    (input.data.subscription_id as string | undefined) ??
      (input.data.subscription as { id?: string } | undefined)?.id ??
      "",
  );
  const transactionId = String(input.data.id ?? input.paddleEventId);
  const intent = custom.billingIntent ?? "new_subscription";

  const admin = createSupabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("plan_id")
    .eq("id", userId)
    .maybeSingle();

  const oldPlan = normalizePlanId(profile?.plan_id ?? "free");

  if (intent === "upgrade" || intent === "interval_change" || intent === "new_subscription") {
    await applyImmediatePlanUpgrade({
      userId,
      oldPlan,
      newPlan,
      billingInterval: interval,
      paddleSubscriptionId: subscriptionId || null,
      paddleTransactionId: transactionId,
      idempotencyKey: `paddle:txn:${transactionId}`,
      source: `paddle:transaction.completed:${intent}`,
    });
    return;
  }

  if (intent === "renewal") {
    const claimed = await claimBillingEvent(admin, {
      eventId: `paddle:txn:${transactionId}`,
      userId,
      eventType: "paddle.transaction.completed.renewal",
      subscriptionId: subscriptionId || null,
    });
    if (!claimed) return;

    await syncPlanCreditsForUser({
      userId,
      planId: newPlan,
      periodEndIso: periodEndFromEvent(input.data),
      source: "paddle:transaction.completed:renewal",
      metadata: { paddle_event_id: input.paddleEventId, transaction_id: transactionId },
    });
  }
}

/**
 * Subscription lifecycle — metadata only unless canceled.
 * Credits are granted via transaction.completed (payment confirmed).
 */
export async function handlePaddleSubscriptionEvent(input: {
  eventType: string;
  data: Record<string, unknown>;
  paddleEventId: string;
}): Promise<void> {
  const admin = createSupabaseAdmin();
  const custom = readCustomData(input.data);
  const userId = custom.userId;
  if (!userId) return;

  const status = String(input.data.status ?? "");
  const priceId =
    (input.data.items as Array<{ price?: { id?: string } }> | undefined)?.[0]?.price?.id ??
    (input.data.price_id as string | undefined);
  const planId = normalizePlanId(custom.planId ?? planFromPaddlePrice(priceId));
  const periodEnd = periodEndFromEvent(input.data);
  const subscriptionId = String(input.data.id ?? "");

  if (
    input.eventType === "subscription.activated" ||
    input.eventType === "subscription.created" ||
    input.eventType === "subscription.updated"
  ) {
    if (status === "active" || status === "trialing") {
      await upsertPaddleSubscriptionRow({
        userId,
        subscriptionId,
        planId,
        periodEnd,
        status,
      });

      await claimBillingEvent(admin, {
        eventId: input.paddleEventId,
        userId,
        eventType: `paddle.${input.eventType}`,
        subscriptionId: subscriptionId || null,
        metadata: { note: "subscription_metadata_sync" },
      });

      // Fallback if transaction.completed webhook is delayed — same idempotency key as txn handler.
      if (input.eventType === "subscription.activated" || input.eventType === "subscription.created") {
        const txnId = String(
          (input.data.transaction_id as string | undefined) ??
            (input.data.latest_transaction as { id?: string } | undefined)?.id ??
            "",
        );
        const idempotencyKey = txnId ? `paddle:txn:${txnId}` : `paddle:sub:${subscriptionId}:activated`;

        const { data: profile } = await admin
          .from("profiles")
          .select("plan_id")
          .eq("id", userId)
          .maybeSingle();

        const intent = custom.billingIntent ?? "new_subscription";
        if (intent !== "renewal") {
          await applyImmediatePlanUpgrade({
            userId,
            oldPlan: normalizePlanId(profile?.plan_id ?? "free"),
            newPlan: planId,
            billingInterval: custom.billingInterval ?? "monthly",
            paddleSubscriptionId: subscriptionId,
            paddleTransactionId: txnId || null,
            idempotencyKey,
            source: `paddle:${input.eventType}:fallback`,
          });
        }
      }
    }
  }

  if (input.eventType === "subscription.canceled" || status === "canceled") {
    await admin
      .from("profiles")
      .update({ plan_id: "free", stripe_subscription_id: null })
      .eq("id", userId);

    const claimed = await claimBillingEvent(admin, {
      eventId: input.paddleEventId,
      userId,
      eventType: `paddle.${input.eventType}`,
      subscriptionId: subscriptionId || null,
    });

    if (claimed) {
      await syncPlanCreditsForUser({
        userId,
        planId: "free",
        periodEndIso: periodEnd,
        source: `paddle:${input.eventType}`,
        metadata: { paddle_event_id: input.paddleEventId },
      });
    }
  }
}
