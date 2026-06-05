/**
 * Vodex Paddle billable plans — Starter, Pro, Infinity I–VII.
 * Credits from FIXED_PLAN_CREDITS via credit-formula (P5.4.3).
 */
import {
  ANNUAL_BILLING_DISCOUNT,
  creditsForPlanId,
} from "@/lib/billing/credit-formula";
import type { PlanId } from "@/lib/supabase/types";

export { ANNUAL_BILLING_DISCOUNT };
export const INFINITY_VOLUME_DISCOUNT = 0.05;

export type BillablePlanId =
  | "starter"
  | "pro"
  | "infinity_i"
  | "infinity_ii"
  | "infinity_iii"
  | "infinity_iv"
  | "infinity_v"
  | "infinity_vi"
  | "infinity_vii";

export const BILLABLE_PLAN_IDS: readonly BillablePlanId[] = [
  "starter",
  "pro",
  "infinity_i",
  "infinity_ii",
  "infinity_iii",
  "infinity_iv",
  "infinity_v",
  "infinity_vi",
  "infinity_vii",
] as const;

export type BillablePlanDefinition = {
  id: BillablePlanId;
  label: string;
  baseMonthlyUsd: number;
  /** 5% volume discount (Infinity IV–VII). */
  volumeDiscount?: number;
  buildCredits: number;
  actionCredits: number;
  storagePlanId: PlanId;
  env: {
    monthlyPriceKey: string;
    annualPriceKey: string;
    productKey: string;
    legacyMonthlyPriceKey?: string;
  };
};

const INFINITY_TIER_DEFS: Omit<BillablePlanDefinition, "env" | "buildCredits" | "actionCredits">[] = [
  { id: "infinity_i", label: "Infinity I", baseMonthlyUsd: 100, storagePlanId: "infinity_i" },
  { id: "infinity_ii", label: "Infinity II", baseMonthlyUsd: 200, storagePlanId: "infinity_ii" },
  { id: "infinity_iii", label: "Infinity III", baseMonthlyUsd: 300, storagePlanId: "infinity_iii" },
  {
    id: "infinity_iv",
    label: "Infinity IV",
    baseMonthlyUsd: 400,
    volumeDiscount: INFINITY_VOLUME_DISCOUNT,
    storagePlanId: "infinity_iv",
  },
  {
    id: "infinity_v",
    label: "Infinity V",
    baseMonthlyUsd: 600,
    volumeDiscount: INFINITY_VOLUME_DISCOUNT,
    storagePlanId: "infinity_v",
  },
  {
    id: "infinity_vi",
    label: "Infinity VI",
    baseMonthlyUsd: 900,
    volumeDiscount: INFINITY_VOLUME_DISCOUNT,
    storagePlanId: "infinity_vi",
  },
  {
    id: "infinity_vii",
    label: "Infinity VII",
    baseMonthlyUsd: 1300,
    volumeDiscount: INFINITY_VOLUME_DISCOUNT,
    storagePlanId: "infinity_vii",
  },
];

function infinityEnvKeys(id: BillablePlanId): BillablePlanDefinition["env"] {
  const roman = id.replace("infinity_", "").toUpperCase();
  return {
    monthlyPriceKey: `PADDLE_INFINITY_${roman}_MONTHLY_PRICE_ID`,
    annualPriceKey: `PADDLE_INFINITY_${roman}_ANNUAL_PRICE_ID`,
    productKey: `PADDLE_INFINITY_${roman}_PRODUCT_ID`,
    ...(id === "infinity_i"
      ? { legacyMonthlyPriceKey: "PADDLE_INFINITY_MONTHLY_PRICE_ID" }
      : {}),
  };
}

function withCreditsAndEnv(
  partial: Omit<BillablePlanDefinition, "env" | "buildCredits" | "actionCredits">,
): BillablePlanDefinition {
  const price = monthlyPriceUsd({
    ...partial,
    buildCredits: 0,
    actionCredits: 0,
    env: infinityEnvKeys(partial.id),
  } as BillablePlanDefinition);
  const { buildCredits, actionCredits } = creditsForPlanId(partial.id);
  return {
    ...partial,
    buildCredits,
    actionCredits,
    env: infinityEnvKeys(partial.id),
  };
}

const STARTER_DEF = withCreditsAndEnv({
  id: "starter",
  label: "Starter",
  baseMonthlyUsd: 20,
  storagePlanId: "starter",
});

const PRO_DEF = withCreditsAndEnv({
  id: "pro",
  label: "Pro",
  baseMonthlyUsd: 50,
  storagePlanId: "pro",
});

export const BILLABLE_PLAN_DEFINITIONS: readonly BillablePlanDefinition[] = [
  {
    ...STARTER_DEF,
    env: {
      monthlyPriceKey: "PADDLE_STARTER_MONTHLY_PRICE_ID",
      annualPriceKey: "PADDLE_STARTER_ANNUAL_PRICE_ID",
      productKey: "PADDLE_STARTER_PRODUCT_ID",
      legacyMonthlyPriceKey: "PADDLE_STARTER_PRICE_ID",
    },
  },
  {
    ...PRO_DEF,
    env: {
      monthlyPriceKey: "PADDLE_PRO_MONTHLY_PRICE_ID",
      annualPriceKey: "PADDLE_PRO_ANNUAL_PRICE_ID",
      productKey: "PADDLE_PRO_PRODUCT_ID",
      legacyMonthlyPriceKey: "PADDLE_PRO_PRICE_ID",
    },
  },
  ...INFINITY_TIER_DEFS.map((p) => withCreditsAndEnv(p)),
] as const;

export function billablePlanDefinition(plan: BillablePlanId): BillablePlanDefinition {
  const def = BILLABLE_PLAN_DEFINITIONS.find((p) => p.id === plan);
  if (!def) throw new Error(`Unknown billable plan: ${plan}`);
  return def;
}

export function monthlyPriceUsd(def: BillablePlanDefinition): number {
  if (def.volumeDiscount) {
    return Math.round(def.baseMonthlyUsd * (1 - def.volumeDiscount));
  }
  return def.baseMonthlyUsd;
}

/** Annual total at 20% off 12× monthly list price. */
export function annualPriceUsd(def: BillablePlanDefinition): number {
  return Math.round(monthlyPriceUsd(def) * 12 * (1 - ANNUAL_BILLING_DISCOUNT));
}

/** Monthly credits from list price — same for monthly and annual subscribers. */
export function actionCreditsForBillablePlan(def: BillablePlanDefinition): number {
  return creditsForPlanId(def.id).actionCredits;
}

export function buildCreditsForBillablePlan(def: BillablePlanDefinition): number {
  return creditsForPlanId(def.id).buildCredits;
}

const CHECKOUT_ALIASES: Record<string, BillablePlanId> = {
  infinity: "infinity_i",
  enterprise: "infinity_i",
};

export function normalizeBillablePlanId(plan: string | null | undefined): BillablePlanId | null {
  if (!plan?.trim()) return null;
  const key = plan.trim().toLowerCase();
  if (CHECKOUT_ALIASES[key]) return CHECKOUT_ALIASES[key];
  if ((BILLABLE_PLAN_IDS as readonly string[]).includes(key)) return key as BillablePlanId;
  return null;
}

export function billablePlanToStoragePlanId(plan: BillablePlanId): PlanId {
  return billablePlanDefinition(plan).storagePlanId;
}

export function infinityTierIdToBillablePlan(tierId: string): BillablePlanId | null {
  const map: Record<string, BillablePlanId> = {
    "inf-1": "infinity_i",
    "inf-2": "infinity_ii",
    "inf-3": "infinity_iii",
    "inf-4": "infinity_iv",
    "inf-5": "infinity_v",
    "inf-6": "infinity_vi",
    "inf-7": "infinity_vii",
  };
  return map[tierId] ?? null;
}

export const PADDLE_CATALOG_ENV_KEYS = [
  "PADDLE_ENVIRONMENT",
  "PADDLE_API_KEY",
  "PADDLE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_PADDLE_CLIENT_TOKEN",
  ...BILLABLE_PLAN_DEFINITIONS.flatMap((p) => [p.env.monthlyPriceKey, p.env.annualPriceKey]),
  ...BILLABLE_PLAN_DEFINITIONS.map((p) => p.env.productKey),
] as const;

export const PADDLE_LEGACY_PRICE_ENV_KEYS = [
  "PADDLE_STARTER_PRICE_ID",
  "PADDLE_PRO_PRICE_ID",
  "PADDLE_INFINITY_MONTHLY_PRICE_ID",
  "PADDLE_INFINITY_PRICE_ID",
  "PADDLE_INFINITY_ANNUAL_PRICE_ID",
] as const;

export function readEnvPrice(key: string, legacyKey?: string): string | null {
  return process.env[key]?.trim() || (legacyKey ? process.env[legacyKey]?.trim() : null) || null;
}
