import {
  detectPaddleSimulation,
  parseWebhookCustomData,
  readWebhookIds,
  readWebhookUserId,
  storePaddleWebhookEvent,
  type PaddleWebhookProcessingStatus,
} from "@/lib/billing/paddle-event-store";
import {
  handlePaddleSubscriptionEvent,
  handlePaddleTransactionCompleted,
} from "@/lib/billing/paddle-webhook-handlers";
import { storagePlanIdFromCustomData, readPaddleCheckoutCustomData } from "@/lib/billing/paddle-checkout-custom-data";
import { planFromPaddlePriceId } from "@/lib/billing/plan-billing-catalog";
import { paddleEnvironment } from "@/lib/billing/paddle-billing";

const ENTITLEMENT_EVENTS = new Set([
  "transaction.completed",
  "transaction.paid",
]);

const PAYMENT_FAILURE_EVENTS = new Set([
  "transaction.payment_failed",
  "transaction.past_due",
  "subscription.past_due",
  "subscription.payment_failed",
]);

const SUBSCRIPTION_EVENTS = new Set([
  "subscription.created",
  "subscription.activated",
  "subscription.updated",
  "subscription.canceled",
  "subscription.paused",
  "subscription.resumed",
  "subscription.past_due",
  "subscription.trialing",
]);

const METADATA_ONLY_EVENTS = new Set([
  "transaction.canceled",
  "transaction.updated",
  "customer.created",
  "customer.updated",
  "payment_method.saved",
  "payment_method.deleted",
  "adjustment.created",
  "adjustment.updated",
]);

export type ProcessPaddleWebhookResult = {
  received: true;
  eventId: string;
  eventType: string;
  processingStatus: PaddleWebhookProcessingStatus;
  duplicate: boolean;
};

function canResolvePlanFromWebhook(data: Record<string, unknown>, priceId: string | null): boolean {
  const custom = readPaddleCheckoutCustomData(data);
  if (storagePlanIdFromCustomData(custom)) return true;
  if (priceId && planFromPaddlePriceId(priceId)) return true;
  return false;
}

export async function processPaddleWebhookPayload(input: {
  eventType: string;
  eventId: string;
  data: Record<string, unknown>;
}): Promise<ProcessPaddleWebhookResult> {
  const { eventType, eventId, data } = input;
  const environment = paddleEnvironment();
  const isSimulation = detectPaddleSimulation(eventType, data);
  const userId = readWebhookUserId(data);
  const ids = readWebhookIds(data);
  const mapped = ids.priceId ? planFromPaddlePriceId(ids.priceId) : null;
  const hasCustomData = parseWebhookCustomData(data) != null;
  const planResolvable = canResolvePlanFromWebhook(data, ids.priceId);

  let processingStatus: PaddleWebhookProcessingStatus = "received";
  let error: string | null = null;

  const storeBase = {
    paddleEventId: eventId,
    eventType,
    environment,
    isSimulation,
    userId,
    workspaceId: userId,
    paddleCustomerId: ids.customerId,
    paddleSubscriptionId: ids.subscriptionId,
    paddleTransactionId: ids.transactionId,
    paddlePriceId: ids.priceId,
    plan: mapped?.plan ?? readPaddleCheckoutCustomData(data).planId ?? null,
    interval: mapped?.interval ?? null,
    error: null as string | null,
    payloadSafe: data,
  };

  if (isSimulation) {
    processingStatus = "received_simulation_or_unlinked";
    const { duplicate } = await storePaddleWebhookEvent({
      ...storeBase,
      processingStatus,
      error: "simulation",
    });
    return { received: true, eventId, eventType, processingStatus, duplicate };
  }

  if (!userId) {
    processingStatus = hasCustomData ? "missing_custom_data" : "received_simulation_or_unlinked";
    error = hasCustomData ? "missing_user_id" : "missing_user_id";
    const { duplicate } = await storePaddleWebhookEvent({
      ...storeBase,
      processingStatus,
      error,
    });
    return { received: true, eventId, eventType, processingStatus, duplicate };
  }

  if (ids.priceId && !mapped && !planResolvable) {
    processingStatus = "unknown_price_id";
    error = "unknown_price_id";
    const { duplicate } = await storePaddleWebhookEvent({
      ...storeBase,
      processingStatus,
      error,
    });
    return { received: true, eventId, eventType, processingStatus, duplicate };
  }

  if (PAYMENT_FAILURE_EVENTS.has(eventType)) {
    processingStatus = "payment_failed_no_upgrade";
    const { duplicate } = await storePaddleWebhookEvent({
      ...storeBase,
      processingStatus,
      error: null,
    });
    if (!duplicate && eventType.startsWith("subscription.")) {
      await handlePaddleSubscriptionEvent({ eventType, data, paddleEventId: eventId });
    }
    return { received: true, eventId, eventType, processingStatus, duplicate };
  }

  if (ENTITLEMENT_EVENTS.has(eventType)) {
    try {
      if (shouldProcessEntitlementTransaction(eventType, data)) {
        await handlePaddleTransactionCompleted({
          data,
          paddleEventId: eventId,
          eventType,
        });
        processingStatus = "processed";
      } else {
        processingStatus = "received";
      }
    } catch (handlerErr) {
      processingStatus = "failed";
      error =
        handlerErr instanceof Error ? handlerErr.message.slice(0, 200) : "handler_failed";
    }
    const { duplicate } = await storePaddleWebhookEvent({
      ...storeBase,
      processingStatus,
      error,
    });
    return { received: true, eventId, eventType, processingStatus, duplicate };
  }

  if (SUBSCRIPTION_EVENTS.has(eventType) || eventType.startsWith("subscription.")) {
    if (userId && planResolvable) {
      try {
        await handlePaddleSubscriptionEvent({ eventType, data, paddleEventId: eventId });
        processingStatus = "processed";
      } catch (handlerErr) {
        processingStatus = "failed";
        error =
          handlerErr instanceof Error ? handlerErr.message.slice(0, 200) : "handler_failed";
      }
    } else {
      processingStatus = userId ? "unknown_price_id" : "missing_custom_data";
      error = userId ? "unknown_price_id" : "missing_user_id";
    }
    const { duplicate } = await storePaddleWebhookEvent({
      ...storeBase,
      processingStatus,
      error,
    });
    return { received: true, eventId, eventType, processingStatus, duplicate };
  }

  if (METADATA_ONLY_EVENTS.has(eventType) || eventType.startsWith("customer.")) {
    processingStatus = "received";
    const { duplicate } = await storePaddleWebhookEvent({
      ...storeBase,
      processingStatus,
      error: null,
    });
    return { received: true, eventId, eventType, processingStatus, duplicate };
  }

  const { duplicate } = await storePaddleWebhookEvent({
    ...storeBase,
    processingStatus: "received",
    error: null,
  });
  return { received: true, eventId, eventType, processingStatus, duplicate };
}

function shouldProcessEntitlementTransaction(
  eventType: string,
  data: Record<string, unknown>,
): boolean {
  if (eventType === "transaction.paid") return true;
  const status = String(data.status ?? "").toLowerCase();
  return status === "completed" || status === "paid";
}
