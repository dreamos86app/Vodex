import { NextResponse } from "next/server";

export const DREAMOS_BILLING_PADDLE_ONLY_MESSAGE = "DreamOS86 billing uses Paddle.";

/** Legacy DreamOS86 Stripe subscription routes stay off unless explicitly enabled for dev. */
export function dreamosStripeSubscriptionBillingEnabled(): boolean {
  return process.env.DREAMOS_STRIPE_SUBSCRIPTION_BILLING_ENABLED === "true";
}

/** Block /api/billing/* Stripe subscription endpoints (checkout, portal, webhook, cancel, downgrade). */
export function dreamosStripeBillingDisabledResponse(): NextResponse | null {
  if (dreamosStripeSubscriptionBillingEnabled()) return null;
  return NextResponse.json(
    {
      error: DREAMOS_BILLING_PADDLE_ONLY_MESSAGE,
      code: "paddle_only",
      billingProvider: "paddle",
    },
    { status: 410 },
  );
}
