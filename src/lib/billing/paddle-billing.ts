/**
 * DreamOS86 platform billing via Paddle (Merchant of Record).
 * Generated apps use separate payment connectors — not this module.
 */

import {
  BILLABLE_PLAN_IDS,
  PADDLE_CATALOG_ENV_KEYS,
  PADDLE_LEGACY_PRICE_ENV_KEYS,
} from "@/lib/billing/billable-plans";
import { assertPaddleCheckoutEnvironment } from "@/lib/billing/paddle-env-consistency";
import {
  getPlanBillingCatalog,
  normalizeBillablePlanId,
  resolveCatalogTier,
  resolvePaddlePriceId,
  type BillablePlanId,
  type CatalogBillingInterval,
} from "@/lib/billing/plan-billing-catalog";

export type PaddleCheckoutPlan = BillablePlanId;

export { PADDLE_CATALOG_ENV_KEYS as PADDLE_ENV_KEYS };

export function paddleEnvironment(): "sandbox" | "production" {
  const raw = process.env.PADDLE_ENVIRONMENT?.trim().toLowerCase();
  return raw === "production" ? "production" : "sandbox";
}

export function paddleBillingConfigured(): boolean {
  const envOk = assertPaddleCheckoutEnvironment().ok;
  const hasApi = Boolean(process.env.PADDLE_API_KEY?.trim());
  const hasClient = Boolean(process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.trim());
  const starterMonthly = resolvePaddlePriceId("starter", "monthly");
  return envOk && hasApi && hasClient && Boolean(starterMonthly);
}

export function missingPaddleEnvVars(): string[] {
  const missing: string[] = [];
  const required = [
    "PADDLE_API_KEY",
    "PADDLE_WEBHOOK_SECRET",
    "NEXT_PUBLIC_PADDLE_CLIENT_TOKEN",
  ] as const;
  for (const key of required) {
    if (!process.env[key]?.trim()) missing.push(key);
  }
  if (!resolvePaddlePriceId("starter", "monthly")) {
    missing.push("PADDLE_STARTER_MONTHLY_PRICE_ID");
  }
  return missing;
}

export function missingPaidPlanPriceIds(): Array<{
  plan: BillablePlanId;
  interval: CatalogBillingInterval;
}> {
  const gaps: Array<{ plan: BillablePlanId; interval: CatalogBillingInterval }> = [];
  const catalog = getPlanBillingCatalog();
  for (const plan of BILLABLE_PLAN_IDS) {
    for (const interval of ["monthly", "annual"] as const) {
      if (!catalog[plan][interval].priceId) gaps.push({ plan, interval });
    }
  }
  return gaps;
}

/** @deprecated use resolvePaddlePriceId(plan, interval) */
export function getPaddlePriceId(plan: PaddleCheckoutPlan): string | null {
  return resolvePaddlePriceId(plan, "monthly");
}

export function getPaddlePriceIdForInterval(
  plan: PaddleCheckoutPlan,
  interval: CatalogBillingInterval,
): string | null {
  return resolvePaddlePriceId(plan, interval);
}

export function validateCheckoutPlanInterval(
  plan: string,
  interval: string,
): { ok: true; plan: PaddleCheckoutPlan; interval: CatalogBillingInterval } | { ok: false; error: string } {
  const envGate = assertPaddleCheckoutEnvironment();
  if (!envGate.ok) {
    return { ok: false, error: envGate.error };
  }

  const normalized = normalizeBillablePlanId(plan);
  if (!normalized) {
    return { ok: false, error: "Invalid plan" };
  }
  if (!["monthly", "annual"].includes(interval)) {
    return { ok: false, error: "Invalid billing interval" };
  }
  const i = interval as CatalogBillingInterval;
  const priceId = resolvePaddlePriceId(normalized, i);
  if (!priceId) {
    return {
      ok: false,
      error: `Paddle price ID not configured for ${normalized} (${i}). Add the pri_* ID to your environment and redeploy.`,
    };
  }
  if (!priceId.startsWith("pri_")) {
    return {
      ok: false,
      error: `Invalid Paddle price ID for ${normalized} (${i}). Checkout requires pri_* Price IDs, not product IDs.`,
    };
  }
  const tier = resolveCatalogTier(normalized, i);
  if (tier.amountUsd <= 0) {
    return { ok: false, error: "Invalid plan amount" };
  }
  return { ok: true, plan: normalized, interval: i };
}

export type PaddleBillingStatus = {
  configured: boolean;
  primary: "paddle";
  fallbackStripe: boolean;
  missing: string[];
  missingAnnualPrices: Array<{ plan: string; interval: string }>;
  environment: "sandbox" | "production";
  userMessage: string;
};

export function getPaddleBillingStatus(): PaddleBillingStatus {
  const missing = missingPaddleEnvVars();
  const configured = paddleBillingConfigured();
  const stripeFallback = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  const missingAnnual = missingPaidPlanPriceIds().filter((g) => g.interval === "annual");

  return {
    configured,
    primary: "paddle",
    fallbackStripe: stripeFallback,
    missing,
    missingAnnualPrices: missingAnnual.map((g) => ({
      plan: g.plan,
      interval: g.interval,
    })),
    environment: paddleEnvironment(),
    userMessage: configured
      ? missingAnnual.length > 0
        ? "Paddle checkout works for monthly billing. Some annual price IDs are not configured yet."
        : "Paddle billing is configured."
      : missing.length > 0
        ? "Subscription checkout is being set up. Your workspace stays active on Free until billing is enabled."
        : "Billing is not configured.",
  };
}

export function paddlePublicConfig() {
  return {
    environment: paddleEnvironment(),
    clientToken: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.trim() || null,
    catalog: getPlanBillingCatalog(),
    legacyEnvKeys: PADDLE_LEGACY_PRICE_ENV_KEYS,
  };
}
