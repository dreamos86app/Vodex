import {
  billablePlanToPlanId,
  normalizeBillablePlanId,
  toUpgradePolicyInterval,
  type BillablePlanId,
  type CatalogBillingInterval,
} from "@/lib/billing/plan-billing-catalog";
import { parseWebhookCustomData } from "@/lib/billing/paddle-event-store";
import { normalizePlanId } from "@/lib/billing/plans";
import type { PlanId } from "@/lib/supabase/types";
export type PaddleCheckoutBillingIntent =
  | "new_subscription"
  | "upgrade"
  | "interval_change"
  | "renewal";

export type PaddleCheckoutCustomData = {
  user_id: string;
  workspace_id: string;
  plan_id: BillablePlanId;
  billing_interval: "monthly" | "yearly";
  price_id: string;
  source: string;
  billing_intent: PaddleCheckoutBillingIntent;
  test_mode?: boolean;
};

/** Canonical custom_data attached server-side to Paddle transactions. */
export function buildPaddleCheckoutCustomData(input: {
  userId: string;
  workspaceId: string;
  planId: BillablePlanId;
  interval: CatalogBillingInterval;
  priceId: string;
  source: string;
  billingIntent?: PaddleCheckoutBillingIntent;
  testMode?: boolean;
}): PaddleCheckoutCustomData {
  if (!input.userId?.trim()) {
    throw new Error("Checkout requires a signed-in user.");
  }
  if (!input.workspaceId?.trim()) {
    throw new Error("Checkout requires an active workspace.");
  }
  if (!input.priceId?.trim()) {
    throw new Error("Checkout could not resolve a Paddle price ID.");
  }

  return {
    user_id: input.userId,
    workspace_id: input.workspaceId,
    plan_id: input.planId,
    billing_interval: toUpgradePolicyInterval(input.interval),
    price_id: input.priceId,
    source: input.source,
    billing_intent: input.billingIntent ?? "new_subscription",
    ...(input.testMode ? { test_mode: true } : {}),
  };
}

export type ParsedPaddleCheckoutCustomData = {
  userId?: string;
  workspaceId?: string;
  planId?: string;
  billingInterval?: "monthly" | "yearly";
  priceId?: string;
  source?: string;
  billingIntent?: string;
  testMode?: boolean;
};

export function readPaddleCheckoutCustomData(
  data: Record<string, unknown>,
): ParsedPaddleCheckoutCustomData {
  const custom = parseWebhookCustomData(data);
  if (!custom) return {};

  const userId = pickString(custom, "user_id", "userId");
  const workspaceId = pickString(custom, "workspace_id", "workspaceId") ?? userId;
  const planId = pickString(custom, "plan_id", "planId");
  const priceId = pickString(custom, "price_id", "priceId");
  const source = pickString(custom, "source");
  const billingIntent = pickString(custom, "billing_intent", "billingIntent");
  const intervalRaw = pickString(custom, "billing_interval", "billingInterval");
  const billingInterval =
    intervalRaw === "yearly" || intervalRaw === "annual" ? "yearly" : intervalRaw === "monthly" ? "monthly" : undefined;

  return {
    userId,
    workspaceId,
    planId,
    billingInterval,
    priceId,
    source,
    billingIntent,
    testMode: custom.test_mode === true || custom.testMode === true,
  };
}

function pickString(
  obj: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

export function storagePlanIdFromCustomData(
  custom: ParsedPaddleCheckoutCustomData,
): PlanId | null {
  if (!custom.planId) return null;
  const billable = normalizeBillablePlanId(custom.planId);
  if (billable) return billablePlanToPlanId(billable);
  return normalizePlanId(custom.planId);
}
