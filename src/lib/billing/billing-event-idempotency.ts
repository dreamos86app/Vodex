import type { SupabaseClient } from "@supabase/supabase-js";

/** Returns true if this event was newly recorded (safe to apply side effects). */
export async function claimBillingEvent(
  admin: SupabaseClient,
  input: {
    eventId: string;
    userId: string;
    eventType: string;
    amountUsd?: number;
    subscriptionId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<boolean> {
  const { error } = await admin.from("billing_events").insert({
    user_id: input.userId,
    stripe_event_id: input.eventId,
    event_type: input.eventType,
    amount_usd: input.amountUsd ?? 0,
    stripe_subscription_id: input.subscriptionId ?? null,
    metadata: input.metadata ?? {},
  } as never);

  if (error && String(error.code) === "23505") {
    return false;
  }
  if (error) {
    throw error;
  }
  return true;
}
