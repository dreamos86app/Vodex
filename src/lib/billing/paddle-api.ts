import { createHmac, timingSafeEqual } from "node:crypto";
import {
  isKnownPaddlePriceId,
  resolvePaddlePriceId,
  toUpgradePolicyInterval,
  type BillablePlanId,
  type CatalogBillingInterval,
} from "@/lib/billing/plan-billing-catalog";
import { logPaddleCheckoutAttempt } from "@/lib/billing/paddle-event-store";
import { assertPaddleCheckoutEnvironment } from "@/lib/billing/paddle-env-consistency";
import {
  missingPaddleEnvVars,
  paddleBillingConfigured,
  paddleEnvironment,
  validateCheckoutPlanInterval,
} from "@/lib/billing/paddle-billing";
import { PADDLE_UPGRADE_PRORATION_MODE } from "@/lib/billing/upgrade-policy";
import { resolvePaddleTransactionCheckoutUrl } from "@/lib/billing/paddle-checkout-url";
import { buildPaddleCheckoutCustomData } from "@/lib/billing/paddle-checkout-custom-data";

function paddleApiBase(): string {
  return paddleEnvironment() === "production"
    ? "https://api.paddle.com"
    : "https://sandbox-api.paddle.com";
}

export type PaddleCheckoutResult =
  | {
      ok: true;
      checkoutUrl: string;
      transactionId?: string;
      paddleCheckoutUrlSent: string | null;
      paddleCheckoutUrlMode: "explicit" | "default";
    }
  | { ok: false; code: "setup_required" | "api_error" | "invalid_price"; error: string; missing?: string[] };

export type PaddleBillingIntent = "new_subscription" | "upgrade" | "interval_change";

export type PaddleCheckoutDiscountMeta = {
  requestedPromoCode?: string | null;
  requestedDiscountId?: string | null;
  appliedMode?: "discount_id" | "discount_code";
  appliedValue?: string;
  paddleDiscountId?: string | null;
  paddleDiscountCode?: string | null;
};

export async function createPaddleCheckoutSession(input: {
  planId: BillablePlanId;
  interval?: CatalogBillingInterval;
  userId: string;
  email: string;
  successUrl: string;
  cancelUrl: string;
  billingIntent?: PaddleBillingIntent;
  billingAttemptId?: string;
  source?: "pricing" | "admin_test_checkout" | "settings";
  testMode?: boolean;
  /** Paddle catalog discount id (dsc_…) — mutually exclusive with discountCode */
  discountId?: string;
  /** Paddle checkout discount code — must exist in Paddle dashboard */
  discountCode?: string;
}): Promise<
  PaddleCheckoutResult & { discount?: PaddleCheckoutDiscountMeta }
> {
  const envGate = assertPaddleCheckoutEnvironment();
  if (!envGate.ok) {
    return { ok: false, code: "setup_required", error: envGate.error, missing: envGate.errors };
  }

  if (!paddleBillingConfigured()) {
    return {
      ok: false,
      code: "setup_required",
      error: "Paddle billing is not configured yet.",
      missing: missingPaddleEnvVars(),
    };
  }

  const interval = input.interval ?? "monthly";
  const validated = validateCheckoutPlanInterval(input.planId, interval);
  if (!validated.ok) {
    return { ok: false, code: "invalid_price", error: validated.error };
  }

  const priceId = resolvePaddlePriceId(validated.plan, validated.interval);
  if (!priceId || !isKnownPaddlePriceId(priceId)) {
    return {
      ok: false,
      code: "invalid_price",
      error: "Price ID is not in the Vodex catalog",
    };
  }

  const checkoutUrlResolution = resolvePaddleTransactionCheckoutUrl();
  if (!checkoutUrlResolution.ok) {
    return {
      ok: false,
      code: "setup_required",
      error: checkoutUrlResolution.error,
    };
  }

  const apiKey = process.env.PADDLE_API_KEY!.trim();

  const customData = buildPaddleCheckoutCustomData({
    userId: input.userId,
    workspaceId: input.userId,
    planId: validated.plan,
    interval: validated.interval,
    priceId,
    source: input.source ?? "pricing",
    billingIntent: input.billingIntent ?? "new_subscription",
    billingAttemptId: input.billingAttemptId,
    testMode: input.testMode ?? false,
  });

  const transactionBody: Record<string, unknown> = {
    items: [{ price_id: priceId, quantity: 1 }],
    customer: { email: input.email },
    custom_data: customData,
  };

  const discountMeta: PaddleCheckoutDiscountMeta = {
    requestedPromoCode: input.discountCode ?? null,
    requestedDiscountId: input.discountId ?? null,
  };

  if (input.discountId?.trim()) {
    transactionBody.discount_id = input.discountId.trim();
    discountMeta.appliedMode = "discount_id";
    discountMeta.appliedValue = input.discountId.trim();
  } else if (input.discountCode?.trim()) {
    const code = input.discountCode.trim().toUpperCase();
    transactionBody.discount = { code };
    discountMeta.appliedMode = "discount_code";
    discountMeta.appliedValue = code;
  }

  if (checkoutUrlResolution.url) {
    transactionBody.checkout = { url: checkoutUrlResolution.url };
  }

  try {
    const res = await fetch(`${paddleApiBase()}/transactions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(transactionBody),
    });

    const json = (await res.json()) as {
      data?: {
        checkout?: { url?: string };
        id?: string;
        discount_id?: string | null;
        discount?: { code?: string | null; id?: string | null };
      };
      error?: { detail?: string; code?: string };
    };

    if (!res.ok) {
      const detail = json.error?.detail ?? `Paddle API ${res.status}`;
      const discountRejected =
        discountMeta.appliedMode &&
        /discount/i.test(detail);
      return {
        ok: false,
        code: "api_error",
        error: discountRejected
          ? `Paddle rejected discount: ${detail}`
          : detail,
        discount: {
          ...discountMeta,
          paddleDiscountCode: discountMeta.appliedValue ?? null,
        },
      };
    }

    const checkoutUrl = json.data?.checkout?.url;
    if (!checkoutUrl) {
      return { ok: false, code: "api_error", error: "Paddle did not return a checkout URL" };
    }

    discountMeta.paddleDiscountId = json.data?.discount_id ?? json.data?.discount?.id ?? null;
    discountMeta.paddleDiscountCode =
      json.data?.discount?.code ?? discountMeta.appliedValue ?? null;

    await logPaddleCheckoutAttempt({
      userId: input.userId,
      plan: validated.plan,
      interval: validated.interval,
      priceId,
      source: input.source ?? "pricing",
      transactionId: json.data?.id,
      testMode: input.testMode,
    });

    return {
      ok: true,
      checkoutUrl,
      transactionId: json.data?.id,
      paddleCheckoutUrlSent: checkoutUrlResolution.url,
      paddleCheckoutUrlMode: checkoutUrlResolution.mode,
      discount: discountMeta,
    };
  } catch (e) {
    return {
      ok: false,
      code: "api_error",
      error: e instanceof Error ? e.message : "Paddle request failed",
    };
  }
}

export type PaddleSubscriptionUpdateResult =
  | { ok: true; subscriptionId: string }
  | { ok: false; code: "setup_required" | "api_error" | "invalid_price"; error: string; missing?: string[] };

/**
 * Upgrade an existing Paddle subscription — full plan charge, no proration.
 */
export async function updatePaddleSubscriptionPlan(input: {
  subscriptionId: string;
  planId: BillablePlanId;
  interval?: CatalogBillingInterval;
  userId: string;
  billingIntent?: PaddleBillingIntent;
  billingAttemptId?: string;
}): Promise<PaddleSubscriptionUpdateResult> {
  if (!paddleBillingConfigured()) {
    return {
      ok: false,
      code: "setup_required",
      error: "Paddle billing is not configured yet.",
      missing: missingPaddleEnvVars(),
    };
  }

  const interval = input.interval ?? "monthly";
  const validated = validateCheckoutPlanInterval(input.planId, interval);
  if (!validated.ok) {
    return { ok: false, code: "invalid_price", error: validated.error };
  }

  const priceId = resolvePaddlePriceId(validated.plan, validated.interval);
  if (!priceId || !isKnownPaddlePriceId(priceId)) {
    return { ok: false, code: "invalid_price", error: "Price ID is not in the Vodex catalog" };
  }

  const apiKey = process.env.PADDLE_API_KEY!.trim();

  try {
    const res = await fetch(`${paddleApiBase()}/subscriptions/${input.subscriptionId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{ price_id: priceId, quantity: 1 }],
        proration_billing_mode: PADDLE_UPGRADE_PRORATION_MODE,
        custom_data: buildPaddleCheckoutCustomData({
          userId: input.userId,
          workspaceId: input.userId,
          planId: validated.plan,
          interval: validated.interval,
          priceId,
          source: "settings",
          billingIntent: input.billingIntent ?? "upgrade",
          billingAttemptId: input.billingAttemptId,
        }),
      }),
    });

    const json = (await res.json()) as {
      data?: { id?: string };
      error?: { detail?: string };
    };

    if (!res.ok) {
      return {
        ok: false,
        code: "api_error",
        error: json.error?.detail ?? `Paddle API ${res.status}`,
      };
    }

    return { ok: true, subscriptionId: json.data?.id ?? input.subscriptionId };
  } catch (e) {
    return {
      ok: false,
      code: "api_error",
      error: e instanceof Error ? e.message : "Paddle request failed",
    };
  }
}

export type PaddleCancelSubscriptionResult =
  | { ok: true; cancelAtPeriodEnd: true; currentPeriodEnd: string | null }
  | { ok: false; code: "setup_required" | "api_error"; error: string; missing?: string[] };

/** Cancel renewal at end of current billing period (default Paddle behavior). */
export async function cancelPaddleSubscriptionAtPeriodEnd(subscriptionId: string): Promise<PaddleCancelSubscriptionResult> {
  if (!paddleBillingConfigured()) {
    return {
      ok: false,
      code: "setup_required",
      error: "Paddle billing is not configured yet.",
      missing: missingPaddleEnvVars(),
    };
  }

  const apiKey = process.env.PADDLE_API_KEY!.trim();

  try {
    const res = await fetch(`${paddleApiBase()}/subscriptions/${subscriptionId}/cancel`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ effective_from: "next_billing_period" }),
    });

    const json = (await res.json()) as {
      data?: {
        current_billing_period?: { ends_at?: string };
        scheduled_change?: { effective_at?: string };
      };
      error?: { detail?: string };
    };

    if (!res.ok) {
      return {
        ok: false,
        code: "api_error",
        error: json.error?.detail ?? `Paddle API ${res.status}`,
      };
    }

    const periodEnd =
      json.data?.current_billing_period?.ends_at ??
      json.data?.scheduled_change?.effective_at ??
      null;

    return { ok: true, cancelAtPeriodEnd: true, currentPeriodEnd: periodEnd };
  } catch (e) {
    return {
      ok: false,
      code: "api_error",
      error: e instanceof Error ? e.message : "Paddle cancel request failed",
    };
  }
}

/** Verify Paddle-Signature header (Paddle Billing webhooks). */
export function verifyPaddleWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader?.trim() || !secret.trim()) return false;
  try {
    const parts = Object.fromEntries(
      signatureHeader.split(";").map((p) => {
        const [k, v] = p.trim().split("=");
        return [k, v];
      }),
    );
    const ts = parts.ts;
    const h1 = parts.h1;
    if (!ts || !h1) return false;
    const payload = `${ts}:${rawBody}`;
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    return timingSafeEqual(Buffer.from(h1), Buffer.from(expected));
  } catch {
    return false;
  }
}
