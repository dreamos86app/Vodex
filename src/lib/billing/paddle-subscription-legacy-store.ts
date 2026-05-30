import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanId } from "@/lib/supabase/types";
import { buildProfilePaddleBillingUpdate } from "@/lib/billing/paddle-profile-fields";

/**
 * DreamOS86 subscription mirror rows (public.subscriptions).
 * Postgres column names predate Paddle-only billing; Paddle IDs are stored in those columns
 * until a future subscriptions-table rename migration.
 */

export async function upsertPaddleSubscriptionMirror(
  admin: SupabaseClient,
  input: {
    userId: string;
    subscriptionId: string;
    customerId?: string | null;
    priceId?: string | null;
    planId: PlanId;
    planInterval: "monthly" | "yearly";
    status: string;
    periodStart: string;
    periodEnd: string;
    creditsPerPeriod: number;
    pendingDowngradePlan?: string | null;
  },
): Promise<void> {
  await admin.from("subscriptions").upsert(
    {
      user_id: input.userId,
      stripe_subscription_id: input.subscriptionId,
      stripe_customer_id: input.customerId?.startsWith("ctm_") ? input.customerId : undefined,
      stripe_price_id: input.priceId ?? undefined,
      plan_id: input.planId,
      plan_interval: input.planInterval,
      credits_per_period: input.creditsPerPeriod,
      status: input.status,
      current_period_start: input.periodStart,
      current_period_end: input.periodEnd,
      pending_downgrade_plan: input.pendingDowngradePlan ?? null,
    } as never,
    { onConflict: "stripe_subscription_id" },
  );
}

export async function updateProfilePaddleBilling(
  admin: SupabaseClient,
  userId: string,
  input: {
    customerId?: string | null;
    subscriptionId?: string | null;
    priceId?: string | null;
    planId?: PlanId;
    subscriptionStatus?: string;
    creditsRemaining?: number;
    creditsResetAt?: string;
  },
): Promise<void> {
  await admin
    .from("profiles")
    .update({
      ...buildProfilePaddleBillingUpdate({
        customerId: input.customerId,
        subscriptionId: input.subscriptionId,
        priceId: input.priceId,
      }),
      ...(input.planId ? { plan_id: input.planId } : {}),
      ...(input.subscriptionStatus ? { subscription_status: input.subscriptionStatus } : {}),
      ...(input.creditsRemaining != null ? { credits_remaining: input.creditsRemaining } : {}),
      ...(input.creditsResetAt ? { credits_reset_at: input.creditsResetAt } : {}),
    } as never)
    .eq("id", userId);
}

export async function touchPaddleSubscriptionIds(
  admin: SupabaseClient,
  input: {
    userId: string;
    subscriptionId: string;
    customerId?: string | null;
    priceId?: string | null;
  },
): Promise<void> {
  await admin.from("subscriptions").upsert(
    {
      user_id: input.userId,
      stripe_subscription_id: input.subscriptionId,
      ...(input.customerId?.startsWith("ctm_") ? { stripe_customer_id: input.customerId } : {}),
      ...(input.priceId?.startsWith("pri_") ? { stripe_price_id: input.priceId } : {}),
    } as never,
    { onConflict: "stripe_subscription_id" },
  );
}

type SubscriptionRow = {
  id?: string;
  user_id?: string;
  plan_interval?: string;
  current_period_end?: string | null;
  current_period_start?: string | null;
  cancel_at_period_end?: boolean;
  pending_downgrade_plan?: string | null;
  status?: string;
  plan_id?: string;
};

export async function fetchSubscriptionByPaddleId(
  admin: SupabaseClient,
  paddleSubscriptionId: string,
  columns: string,
): Promise<SubscriptionRow | null> {
  const { data } = await admin
    .from("subscriptions")
    .select(columns)
    .eq("stripe_subscription_id", paddleSubscriptionId)
    .maybeSingle();
  return (data ?? null) as SubscriptionRow | null;
}

export async function updateSubscriptionByPaddleId(
  admin: SupabaseClient,
  paddleSubscriptionId: string,
  patch: Record<string, unknown>,
) {
  return admin
    .from("subscriptions")
    .update(patch as never)
    .eq("stripe_subscription_id", paddleSubscriptionId);
}
