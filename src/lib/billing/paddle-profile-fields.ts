import { isPaddleCustomerId } from "@/lib/billing/paddle-customer-portal";

/** Paddle-only profile columns for DreamOS86 platform subscription billing. */
export const PROFILE_PADDLE_BILLING_SELECT =
  "paddle_customer_id, paddle_subscription_id, paddle_price_id, billing_provider";

export type ProfilePaddleBillingFields = {
  paddle_customer_id?: string | null;
  paddle_subscription_id?: string | null;
  paddle_price_id?: string | null;
  billing_provider?: string | null;
};

export function readProfilePaddleCustomerId(
  row: ProfilePaddleBillingFields | null | undefined,
): string | null {
  const id = row?.paddle_customer_id?.trim();
  return isPaddleCustomerId(id) ? id! : null;
}

export function readProfilePaddleSubscriptionId(
  row: ProfilePaddleBillingFields | null | undefined,
): string | null {
  const id = row?.paddle_subscription_id?.trim();
  return id?.startsWith("sub_") ? id : null;
}

export function readProfilePaddlePriceId(
  row: ProfilePaddleBillingFields | null | undefined,
): string | null {
  const id = row?.paddle_price_id?.trim();
  return id?.startsWith("pri_") ? id : null;
}

export function buildProfilePaddleBillingUpdate(input: {
  customerId?: string | null;
  subscriptionId?: string | null;
  priceId?: string | null;
}): Record<string, string> {
  const patch: Record<string, string> = { billing_provider: "paddle" };
  if (isPaddleCustomerId(input.customerId)) {
    patch.paddle_customer_id = input.customerId!.trim();
  }
  if (input.subscriptionId?.trim().startsWith("sub_")) {
    patch.paddle_subscription_id = input.subscriptionId.trim();
  }
  if (input.priceId?.trim().startsWith("pri_")) {
    patch.paddle_price_id = input.priceId.trim();
  }
  return patch;
}

export function buildProfilePaddleSubscriptionClear(): Record<string, null | string> {
  return {
    paddle_subscription_id: null,
    billing_provider: "paddle",
  };
}
