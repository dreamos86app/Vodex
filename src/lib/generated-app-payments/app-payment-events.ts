import "server-only";

import { createHash } from "crypto";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { PaymentProviderId } from "@/lib/generated-app-payments/types";

export type AppPaymentEventInput = {
  projectId: string;
  ownerId: string;
  publishedAppId?: string | null;
  paymentProvider: PaymentProviderId | string;
  eventType: string;
  amountCents?: number | null;
  currency?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
  mode: "sandbox" | "live" | "mock";
  meta?: Record<string, unknown>;
  occurredAt?: string;
};

function hashId(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return createHash("sha256").update(value.trim()).digest("hex").slice(0, 32);
}

export async function insertAppPaymentEvent(input: AppPaymentEventInput): Promise<boolean> {
  const admin = createServiceRoleClient();
  if (!admin) return false;

  const { error } = await admin.from("app_payment_events" as never).insert({
    project_id: input.projectId,
    owner_id: input.ownerId,
    published_app_id: input.publishedAppId ?? null,
    payment_provider: input.paymentProvider,
    event_type: input.eventType,
    amount_cents: input.amountCents ?? null,
    currency: input.currency ?? null,
    customer_id_hash: hashId(input.customerId),
    subscription_id_hash: hashId(input.subscriptionId),
    mode: input.mode,
    meta: input.meta ?? {},
    occurred_at: input.occurredAt ?? new Date().toISOString(),
  } as never);

  if (error) {
    console.error("[app-payment-events]", error.message);
    return false;
  }

  await admin.from("app_analytics_events" as never).insert({
    project_id: input.projectId,
    owner_id: input.ownerId,
    event_type: "payment_event",
    meta: {
      provider: input.paymentProvider,
      payment_event_type: input.eventType,
      amount_cents: input.amountCents,
      currency: input.currency,
      mode: input.mode,
      published_app_id: input.publishedAppId,
    },
  } as never);

  return true;
}
