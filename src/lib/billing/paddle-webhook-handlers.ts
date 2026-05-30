import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { syncPlanCreditsForUser } from "@/lib/billing/sync-plan-credits";
import { applyImmediatePlanUpgrade } from "@/lib/billing/apply-immediate-plan-upgrade";
import { persistPaddleCustomerId } from "@/lib/billing/persist-paddle-customer-id";
import { buildProfilePaddleSubscriptionClear } from "@/lib/billing/paddle-profile-fields";
import {
  updateSubscriptionByPaddleId,
  updateProfilePaddleBilling,
  upsertPaddleSubscriptionMirror,
} from "@/lib/billing/paddle-subscription-legacy-store";
import { claimBillingEvent } from "@/lib/billing/billing-event-idempotency";
import { normalizePlanId } from "@/lib/billing/plans";
import {
  billablePlanToPlanId,
  planFromPaddlePriceId,
} from "@/lib/billing/plan-billing-catalog";
import { syncPaddleMarketingConsent } from "@/lib/billing/paddle-marketing-consent";
import {
  readPaddleCheckoutCustomData,
  storagePlanIdFromCustomData,
} from "@/lib/billing/paddle-checkout-custom-data";
import { readWebhookIds } from "@/lib/billing/paddle-event-store";
import type { BillingInterval } from "@/lib/billing/upgrade-policy";
import type { PlanId } from "@/lib/supabase/types";

function planFromPaddlePrice(priceId: string | undefined): PlanId | null {
  const mapped = planFromPaddlePriceId(priceId);
  if (!mapped) return null;
  return billablePlanToPlanId(mapped.plan);
}

function resolveEntitlementPlan(
  custom: ReturnType<typeof readPaddleCheckoutCustomData>,
  priceId: string | undefined,
): PlanId | null {
  const fromCustom = storagePlanIdFromCustomData(custom);
  if (fromCustom) return fromCustom;
  return planFromPaddlePrice(priceId);
}

function periodEndFromEvent(data: Record<string, unknown>): string {
  const end = data.current_billing_period as { ends_at?: string } | undefined;
  if (end?.ends_at) return end.ends_at;
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
}

function transactionPriceId(data: Record<string, unknown>): string | undefined {
  const ids = readWebhookIds(data);
  return ids.priceId ?? undefined;
}

function shouldProcessPaidTransaction(eventType: string, data: Record<string, unknown>): boolean {
  if (eventType === "transaction.paid") return true;
  const status = String(data.status ?? "").toLowerCase();
  return status === "completed" || status === "paid";
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
  const subStatus = input.status === "trialing" ? "trialing" : "active";
  await upsertPaddleSubscriptionMirror(admin, {
    userId: input.userId,
    subscriptionId: input.subscriptionId,
    planId: input.planId,
    planInterval: "monthly",
    status: subStatus,
    periodStart: now,
    periodEnd: input.periodEnd,
    creditsPerPeriod: 0,
  });
  await updateProfilePaddleBilling(admin, input.userId, {
    subscriptionId: input.subscriptionId,
    planId: input.planId,
    subscriptionStatus: subStatus,
  });
}

/** Grant credits after confirmed payment (transaction.completed / transaction.paid). */
export async function handlePaddleTransactionCompleted(input: {
  data: Record<string, unknown>;
  paddleEventId: string;
  eventType?: string;
}): Promise<void> {
  const eventType = input.eventType ?? "";
  if (!shouldProcessPaidTransaction(eventType, input.data)) return;

  const custom = readPaddleCheckoutCustomData(input.data);
  const userId = custom.userId;
  if (!userId) return;

  await persistPaddleCustomerId({
    userId,
    data: input.data,
    subscriptionId: String(
      (input.data.subscription_id as string | undefined) ??
        (input.data.subscription as { id?: string } | undefined)?.id ??
        "",
    ) || null,
    priceId: custom.priceId ?? transactionPriceId(input.data) ?? null,
  });

  const priceId = custom.priceId ?? transactionPriceId(input.data);
  const newPlan = resolveEntitlementPlan(custom, priceId);
  if (!newPlan) return;

  await syncPaddleMarketingConsent(userId, input.data);

  const interval: BillingInterval = custom.billingInterval ?? "monthly";
  const subscriptionId = String(
    (input.data.subscription_id as string | undefined) ??
      (input.data.subscription as { id?: string } | undefined)?.id ??
      "",
  );
  const customerId =
    (input.data.customer_id as string | undefined) ??
    (input.data.customer as { id?: string } | undefined)?.id ??
    null;
  const transactionId = String(input.data.id ?? input.paddleEventId);
  const intent = custom.billingIntent ?? "new_subscription";

  const admin = createSupabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("plan_id, credits_remaining")
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
      paddlePriceId: priceId ?? null,
      paddleCustomerId: customerId,
      paddleEventId: input.paddleEventId,
      idempotencyKey: `paddle:txn:${transactionId}`,
      source: `paddle:${eventType || "transaction.completed"}:${intent}`,
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
 * Subscription lifecycle — metadata + fallback entitlement when txn webhook is delayed.
 */
export async function handlePaddleSubscriptionEvent(input: {
  eventType: string;
  data: Record<string, unknown>;
  paddleEventId: string;
}): Promise<void> {
  const admin = createSupabaseAdmin();
  const custom = readPaddleCheckoutCustomData(input.data);
  const userId = custom.userId;
  if (!userId) return;

  await persistPaddleCustomerId({
    userId,
    data: input.data,
    subscriptionId: String(input.data.id ?? ""),
  });

  const status = String(input.data.status ?? "");
  const priceId = custom.priceId ?? transactionPriceId(input.data);
  const planId = resolveEntitlementPlan(custom, priceId);
  if (!planId && input.eventType !== "subscription.canceled") return;

  const resolvedPlan = planId ?? "free";
  const periodEnd = periodEndFromEvent(input.data);
  const subscriptionId = String(input.data.id ?? "");

  if (status === "past_due" || input.eventType === "subscription.past_due") {
    await admin
      .from("profiles")
      .update({ subscription_status: "past_due" } as never)
      .eq("id", userId);
    await claimBillingEvent(admin, {
      eventId: input.paddleEventId,
      userId,
      eventType: `paddle.${input.eventType}`,
      subscriptionId: subscriptionId || null,
    });
    return;
  }

  const scheduledChange = input.data.scheduled_change as
    | { action?: string; effective_at?: string }
    | null
    | undefined;
  const cancelScheduled = scheduledChange?.action === "cancel";

  if (
    input.eventType === "subscription.activated" ||
    input.eventType === "subscription.created" ||
    input.eventType === "subscription.updated" ||
    input.eventType === "subscription.resumed"
  ) {
    if (cancelScheduled) {
      const effectiveAt = scheduledChange?.effective_at ?? periodEnd;
      await admin
        .from("profiles")
        .update({
          cancel_at_period_end: true,
          current_period_end: effectiveAt,
        } as never)
        .eq("id", userId);

      await updateSubscriptionByPaddleId(admin, subscriptionId, {
        cancel_at_period_end: true,
        current_period_end: effectiveAt,
      });

      await claimBillingEvent(admin, {
        eventId: input.paddleEventId,
        userId,
        eventType: `paddle.${input.eventType}:cancel_scheduled`,
        subscriptionId: subscriptionId || null,
      });
      return;
    }

    if (status === "active" || status === "trialing") {
      await upsertPaddleSubscriptionRow({
        userId,
        subscriptionId,
        planId: resolvedPlan,
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

      if (
        input.eventType === "subscription.activated" ||
        input.eventType === "subscription.created" ||
        input.eventType === "subscription.resumed"
      ) {
        const txnId = String(
          (input.data.transaction_id as string | undefined) ??
            (input.data.latest_transaction as { id?: string } | undefined)?.id ??
            "",
        );
        const idempotencyKey = txnId ? `paddle:txn:${txnId}` : `paddle:sub:${subscriptionId}:activated`;

        const { data: profile } = await admin
          .from("profiles")
          .select("plan_id, credits_remaining")
          .eq("id", userId)
          .maybeSingle();

        const intent = custom.billingIntent ?? "new_subscription";
        if (intent !== "renewal") {
          const customerId =
            (input.data.customer_id as string | undefined) ??
            (input.data.customer as { id?: string } | undefined)?.id ??
            null;
          await applyImmediatePlanUpgrade({
            userId,
            oldPlan: normalizePlanId(profile?.plan_id ?? "free"),
            newPlan: resolvedPlan,
            billingInterval: custom.billingInterval ?? "monthly",
            paddleSubscriptionId: subscriptionId,
            paddleTransactionId: txnId || null,
            paddlePriceId: priceId ?? null,
            paddleCustomerId: customerId,
            paddleEventId: input.paddleEventId,
            idempotencyKey,
            source: `paddle:${input.eventType}:fallback`,
          });
        }
      }
    }
  }

  if (input.eventType === "subscription.paused") {
    await admin
      .from("profiles")
      .update({ subscription_status: "paused" } as never)
      .eq("id", userId);
    await claimBillingEvent(admin, {
      eventId: input.paddleEventId,
      userId,
      eventType: `paddle.${input.eventType}`,
      subscriptionId: subscriptionId || null,
    });
    return;
  }

  if (input.eventType === "subscription.canceled" || status === "canceled") {
    const claimed = await claimBillingEvent(admin, {
      eventId: input.paddleEventId,
      userId,
      eventType: `paddle.${input.eventType}`,
      subscriptionId: subscriptionId || null,
    });

    if (!claimed) return;

    await admin
      .from("profiles")
      .update({
        plan_id: "free",
        ...buildProfilePaddleSubscriptionClear(),
        cancel_at_period_end: false,
        subscription_status: "canceled",
      } as never)
      .eq("id", userId);

    await updateSubscriptionByPaddleId(admin, subscriptionId, {
      status: "canceled",
      cancel_at_period_end: false,
    });

    await syncPlanCreditsForUser({
      userId,
      planId: "free",
      periodEndIso: periodEnd,
      source: `paddle:${input.eventType}`,
      metadata: { paddle_event_id: input.paddleEventId },
    });
  }
}
