/**
 * Canonical DreamOS86 subscription catalog — Paddle price IDs, amounts, credit allowances.
 * Checkout uses PRICE IDs (pri_*). Product IDs are optional admin/debug only.
 */
import {
  actionCreditsForBillablePlan,
  annualPriceUsd,
  BILLABLE_PLAN_DEFINITIONS,
  BILLABLE_PLAN_IDS,
  billablePlanDefinition,
  billablePlanToStoragePlanId,
  monthlyPriceUsd,
  normalizeBillablePlanId,
  PADDLE_CATALOG_ENV_KEYS,
  PADDLE_LEGACY_PRICE_ENV_KEYS,
  readEnvPrice,
  type BillablePlanId,
} from "@/lib/billing/billable-plans";
import type { PlanId } from "@/lib/supabase/types";

export type { BillablePlanId };
export {
  BILLABLE_PLAN_IDS,
  billablePlanDefinition,
  PADDLE_CATALOG_ENV_KEYS,
  PADDLE_LEGACY_PRICE_ENV_KEYS,
  normalizeBillablePlanId,
} from "@/lib/billing/billable-plans";
export type CatalogBillingInterval = "monthly" | "annual";

export type PlanPriceTier = {
  priceId: string | null;
  productId: string | null;
  amountUsd: number;
  interval: CatalogBillingInterval;
  buildCredits: number;
  actionCredits: number;
  displayText: string;
  planSlug: BillablePlanId;
};

export type PlanBillingCatalogEntry = {
  monthly: PlanPriceTier;
  annual: PlanPriceTier;
};

function tier(
  def: (typeof BILLABLE_PLAN_DEFINITIONS)[number],
  interval: CatalogBillingInterval,
  priceId: string | null,
  productId: string | null,
): PlanPriceTier {
  const amountUsd = interval === "monthly" ? monthlyPriceUsd(def) : annualPriceUsd(def);
  const buildCredits = def.buildCredits;
  const actionCredits = actionCreditsForBillablePlan(def);
  const displayText =
    interval === "monthly"
      ? `$${amountUsd}/mo · ${buildCredits} Build · ${actionCredits} Action`
      : `$${amountUsd}/yr · ${buildCredits} Build · ${actionCredits} Action / mo`;
  return {
    priceId,
    productId,
    amountUsd,
    interval,
    buildCredits,
    actionCredits,
    displayText,
    planSlug: def.id,
  };
}

function resolvePrices(def: (typeof BILLABLE_PLAN_DEFINITIONS)[number]): {
  monthly: string | null;
  annual: string | null;
} {
  const monthly = readEnvPrice(def.env.monthlyPriceKey, def.env.legacyMonthlyPriceKey);
  let annual = readEnvPrice(def.env.annualPriceKey);
  if (!annual && def.id === "infinity_i") {
    annual = readEnvPrice("PADDLE_INFINITY_ANNUAL_PRICE_ID");
  }
  return { monthly, annual };
}

function buildCatalog(): Record<BillablePlanId, PlanBillingCatalogEntry> {
  const catalog = {} as Record<BillablePlanId, PlanBillingCatalogEntry>;

  for (const def of BILLABLE_PLAN_DEFINITIONS) {
    const prices = resolvePrices(def);
    const productId = readEnvPrice(def.env.productKey) || null;
    catalog[def.id] = {
      monthly: tier(def, "monthly", prices.monthly, productId),
      annual: tier(def, "annual", prices.annual, productId),
    };
  }

  return catalog;
}

/** Resolved at request time so env changes apply without rebuild in dev. */
export function getPlanBillingCatalog(): Record<BillablePlanId, PlanBillingCatalogEntry> {
  return buildCatalog();
}

export const planBillingCatalog = buildCatalog();

export function resolveCatalogTier(
  plan: BillablePlanId,
  interval: CatalogBillingInterval,
): PlanPriceTier {
  return getPlanBillingCatalog()[plan][interval];
}

export function resolvePaddlePriceId(
  plan: BillablePlanId,
  interval: CatalogBillingInterval,
): string | null {
  return resolveCatalogTier(plan, interval).priceId;
}

export function isKnownPaddlePriceId(priceId: string): boolean {
  const id = priceId.trim();
  if (!id) return false;
  for (const plan of BILLABLE_PLAN_IDS) {
    for (const interval of ["monthly", "annual"] as const) {
      if (resolveCatalogTier(plan, interval).priceId === id) return true;
    }
  }
  return false;
}

export function planFromPaddlePriceId(priceId: string | undefined): {
  plan: BillablePlanId;
  interval: CatalogBillingInterval;
} | null {
  if (!priceId?.trim()) return null;
  const id = priceId.trim();
  for (const plan of BILLABLE_PLAN_IDS) {
    for (const interval of ["monthly", "annual"] as const) {
      if (resolveCatalogTier(plan, interval).priceId === id) {
        return { plan, interval };
      }
    }
  }
  return null;
}

export function catalogAmountUsd(
  plan: BillablePlanId,
  interval: CatalogBillingInterval,
): number {
  return resolveCatalogTier(plan, interval).amountUsd;
}

export function toUpgradePolicyInterval(
  interval: CatalogBillingInterval,
): "monthly" | "yearly" {
  return interval === "annual" ? "yearly" : "monthly";
}

export function fromUpgradePolicyInterval(
  interval: "monthly" | "yearly",
): CatalogBillingInterval {
  return interval === "yearly" ? "annual" : "monthly";
}

export function billablePlanToPlanId(plan: BillablePlanId): PlanId {
  return billablePlanToStoragePlanId(plan);
}

export function maskId(id: string | null): string {
  if (!id) return "—";
  if (id.length <= 8) return id;
  return `…${id.slice(-4)}`;
}
