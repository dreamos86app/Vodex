/**
 * Gate public pricing checkout until owner live test passes.
 */
export function paddlePublicCheckoutEnabled(): boolean {
  const raw = process.env.PADDLE_PUBLIC_CHECKOUT_ENABLED?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

export function paddleOwnerTestCheckoutEnabled(): boolean {
  return process.env.PADDLE_OWNER_TEST_CHECKOUT_ENABLED?.trim().toLowerCase() !== "false";
}

export function publicCheckoutBlockedMessage(): string {
  if (!paddlePublicCheckoutEnabled()) {
    return "Public checkout is disabled while live billing is being verified. Owner can test at /admin/billing/paddle/test-checkout.";
  }
  return "Billing checkout is not available yet.";
}
