import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isPaddleCustomerId } from "@/lib/billing/paddle-customer-portal";
import { buildProfilePaddleBillingUpdate } from "@/lib/billing/paddle-profile-fields";
import { readWebhookIds } from "@/lib/billing/paddle-event-store";
import { touchPaddleSubscriptionIds } from "@/lib/billing/paddle-subscription-legacy-store";

/** Persist Paddle ctm_* / sub_* / pri_* on profiles.paddle_* columns (not stripe_*). */
export async function persistPaddleCustomerId(input: {
  userId: string;
  data: Record<string, unknown>;
  subscriptionId?: string | null;
  priceId?: string | null;
}): Promise<void> {
  const ids = readWebhookIds(input.data);
  const customerId =
    ids.customerId ??
    (typeof input.data.customer_id === "string" ? input.data.customer_id : null);
  const subId =
    input.subscriptionId ??
    ids.subscriptionId ??
    (typeof input.data.id === "string" && String(input.data.id).startsWith("sub_")
      ? String(input.data.id)
      : null);
  const priceId = input.priceId ?? ids.priceId ?? null;

  if (!isPaddleCustomerId(customerId) && !subId?.startsWith("sub_")) return;

  const admin = createSupabaseAdmin();
  await admin
    .from("profiles")
    .update(
      buildProfilePaddleBillingUpdate({
        customerId: isPaddleCustomerId(customerId) ? customerId : null,
        subscriptionId: subId,
        priceId: priceId?.startsWith("pri_") ? priceId : null,
      }) as never,
    )
    .eq("id", input.userId);

  if (subId?.startsWith("sub_")) {
    await touchPaddleSubscriptionIds(admin, {
      userId: input.userId,
      subscriptionId: subId,
      customerId: isPaddleCustomerId(customerId) ? customerId : null,
      priceId: priceId?.startsWith("pri_") ? priceId : null,
    });
  }
}
