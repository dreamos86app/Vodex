/**
 * Paddle catalog promo codes for owner test checkout.
 * Codes must exist in Paddle Dashboard (Catalog → Discounts) — not local discounts.
 */

export const PADDLE_TEST_PROMO_PRESETS = [
  { code: "VODEXTEST100", label: "100% off (VODEXTEST100)" },
  { code: "VODEXTEST90", label: "90% off (VODEXTEST90)" },
  { code: "VODEXTEST50", label: "50% off (VODEXTEST50)" },
] as const;

export type PaddlePromoApplyInput = {
  promoCode?: string | null;
  discountId?: string | null;
};

export type PaddlePromoApplyResult =
  | { ok: true; mode: "discount_id"; discountId: string }
  | { ok: true; mode: "discount_code"; promoCode: string }
  | { ok: false; error: string };

/** Normalize and validate promo input — never send both code and id to Paddle. */
export function resolvePaddlePromoForTransaction(
  input: PaddlePromoApplyInput,
): PaddlePromoApplyResult {
  const discountId = input.discountId?.trim() ?? "";
  const promoCode = input.promoCode?.trim().toUpperCase() ?? "";

  if (discountId && promoCode) {
    return {
      ok: false,
      error: "Provide either promoCode or discountId, not both.",
    };
  }

  if (discountId) {
    if (!discountId.startsWith("dsc_")) {
      return { ok: false, error: "discountId must be a Paddle catalog id (dsc_…)" };
    }
    return { ok: true, mode: "discount_id", discountId };
  }

  if (promoCode) {
    if (!/^[A-Z0-9_-]{3,32}$/.test(promoCode)) {
      return { ok: false, error: "Invalid promo code format." };
    }
    return { ok: true, mode: "discount_code", promoCode };
  }

  return { ok: false, error: "No promo code provided." };
}

export function isKnownTestPromoCode(code: string): boolean {
  const c = code.trim().toUpperCase();
  return PADDLE_TEST_PROMO_PRESETS.some((p) => p.code === c);
}
