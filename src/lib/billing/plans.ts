import type { PlanId } from "@/lib/supabase/types";
import { BILLABLE_PLAN_DEFINITIONS, monthlyPriceUsd } from "@/lib/billing/billable-plans";
import { BUILD_CREDITS_BY_PLAN } from "@/lib/billing/plan-credit-economics";
import { normalizePlanId as normalizePlanIdCore } from "@/lib/billing/normalize-plan-id";

/** Monthly Build Credit allowance per plan. */
export const PLAN_MONTHLY_TOKENS: Record<PlanId, number> = BUILD_CREDITS_BY_PLAN;

export { normalizePlanIdCore as normalizePlanId };

function buildPlanDisplay(): Record<
  PlanId,
  { name: string; priceMonthlyUsd: number | null; description: string }
> {
  const base: Record<
    PlanId,
    { name: string; priceMonthlyUsd: number | null; description: string }
  > = {
    free: { name: "Free", priceMonthlyUsd: 0, description: "30 credits / month" },
    starter: { name: "Starter", priceMonthlyUsd: 20, description: "200 credits / month" },
    pro: { name: "Pro", priceMonthlyUsd: 50, description: "500 credits / month" },
    business: { name: "Pro", priceMonthlyUsd: 50, description: "500 credits / month (legacy id)" },
    infinity: { name: "Infinity I", priceMonthlyUsd: 100, description: "1,000 credits / month" },
    enterprise: { name: "Infinity I", priceMonthlyUsd: 100, description: "Enterprise tier" },
    infinity_i: { name: "Infinity I", priceMonthlyUsd: 100, description: "1,000 credits / month" },
    infinity_ii: { name: "Infinity II", priceMonthlyUsd: 200, description: "2,000 credits / month" },
    infinity_iii: { name: "Infinity III", priceMonthlyUsd: 300, description: "3,000 credits / month" },
    infinity_iv: { name: "Infinity IV", priceMonthlyUsd: 380, description: "4,000 credits / month" },
    infinity_v: { name: "Infinity V", priceMonthlyUsd: 570, description: "6,000 credits / month" },
    infinity_vi: { name: "Infinity VI", priceMonthlyUsd: 855, description: "9,000 credits / month" },
    infinity_vii: { name: "Infinity VII", priceMonthlyUsd: 1235, description: "13,000 credits / month" },
  };

  for (const p of BILLABLE_PLAN_DEFINITIONS.filter((d) => d.id.startsWith("infinity_"))) {
    base[p.storagePlanId] = {
      name: p.label,
      priceMonthlyUsd: monthlyPriceUsd(p),
      description: `${p.buildCredits.toLocaleString()} credits / month`,
    };
  }

  return base;
}

export const PLAN_DISPLAY = buildPlanDisplay();

/** Paid plans available via Stripe Checkout (not manual one-click). */
export const STRIPE_CHECKOUT_PLANS = ["starter", "pro", "infinity"] as const;
export type StripeCheckoutPlan = (typeof STRIPE_CHECKOUT_PLANS)[number];

export function isStripeCheckoutPlan(plan: string): plan is StripeCheckoutPlan {
  return (STRIPE_CHECKOUT_PLANS as readonly string[]).includes(plan);
}

export function monthlyTokensForPlan(plan: PlanId): number {
  return PLAN_MONTHLY_TOKENS[normalizePlanIdCore(plan)] ?? PLAN_MONTHLY_TOKENS.free;
}

export const STRIPE_ENV_KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_STARTER_PRICE_ID",
  "STRIPE_PRO_PRICE_ID",
  "STRIPE_INFINITY_PRICE_ID",
] as const;

export function getStripePriceId(plan: StripeCheckoutPlan): string | null {
  switch (plan) {
    case "starter":
      return process.env.STRIPE_STARTER_PRICE_ID?.trim() || null;
    case "pro":
      return process.env.STRIPE_PRO_PRICE_ID?.trim() || null;
    case "infinity":
      return process.env.STRIPE_INFINITY_PRICE_ID?.trim() || null;
    default:
      return null;
  }
}

export function stripeBillingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim() && getStripePriceId("starter"));
}

export function missingStripeEnvVars(): string[] {
  const missing: string[] = [];
  if (!process.env.STRIPE_SECRET_KEY?.trim()) missing.push("STRIPE_SECRET_KEY");
  if (!process.env.STRIPE_WEBHOOK_SECRET?.trim()) missing.push("STRIPE_WEBHOOK_SECRET");
  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()) {
    missing.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
  }
  if (!getStripePriceId("starter")) missing.push("STRIPE_STARTER_PRICE_ID");
  if (!getStripePriceId("pro")) missing.push("STRIPE_PRO_PRICE_ID");
  if (!getStripePriceId("infinity")) missing.push("STRIPE_INFINITY_PRICE_ID");
  return missing;
}
