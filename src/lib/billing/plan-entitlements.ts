import {
  monthlyTokensForPlan,
  normalizePlanId,
  PLAN_DISPLAY,
  PLAN_MONTHLY_TOKENS,
} from "@/lib/billing/plans";
import { monthlyActionCreditsForPlan } from "@/lib/action-credits/action-credit-allowances";
import type { PlanId } from "@/lib/supabase/types";

export type PlanTier = "free" | "starter" | "pro" | "infinity";

export type PlanEntitlements = {
  planId: PlanId;
  tier: PlanTier;
  displayName: string;
  buildAllowance: number;
  actionAllowance: number;
  canSelectModel: boolean;
  canEditCode: boolean;
  canUseIntegrations: boolean;
  canUseMobileWrapping: boolean;
  canUseCustomDomain: boolean;
  canUseCustomOAuth: boolean;
  canPublishWeb: boolean;
};

const TIER_ORDER: PlanTier[] = ["free", "starter", "pro", "infinity"];

function toTier(planId: PlanId): PlanTier {
  if (planId === "starter") return "starter";
  if (planId === "pro" || planId === "business") return "pro";
  if (planId === "infinity" || planId === "enterprise") return "infinity";
  return "free";
}

function tierAtLeast(planId: PlanId, min: PlanTier): boolean {
  return TIER_ORDER.indexOf(toTier(planId)) >= TIER_ORDER.indexOf(min);
}

export function getPlanConfig(planId: string | null | undefined) {
  const id = normalizePlanId(planId ?? "free") as PlanId;
  const display = PLAN_DISPLAY[id];
  return {
    id,
    tier: toTier(id),
    name: display.name,
    description: display.description,
    priceMonthlyUsd: display.priceMonthlyUsd,
    buildAllowance: PLAN_MONTHLY_TOKENS[id],
    actionAllowance: monthlyActionCreditsForPlan(id),
  };
}

export function getCreditAllowance(planId: string | null | undefined) {
  const id = normalizePlanId(planId ?? "free");
  return {
    build: monthlyTokensForPlan(id),
    action: monthlyActionCreditsForPlan(id),
  };
}

export function getEntitlements(planId: string | null | undefined): PlanEntitlements {
  const id = normalizePlanId(planId ?? "free") as PlanId;
  const tier = toTier(id);
  const display = PLAN_DISPLAY[id];
  return {
    planId: id,
    tier,
    displayName: display.name,
    buildAllowance: monthlyTokensForPlan(id),
    actionAllowance: monthlyActionCreditsForPlan(id),
    canSelectModel: tierAtLeast(id, "pro"),
    canEditCode: tierAtLeast(id, "pro"),
    canUseIntegrations: tierAtLeast(id, "starter"),
    canUseMobileWrapping: tierAtLeast(id, "pro"),
    canUseCustomDomain: tierAtLeast(id, "starter"),
    canUseCustomOAuth: tierAtLeast(id, "pro"),
    canPublishWeb: true,
  };
}

export function canSelectModel(planId: string | null | undefined): boolean {
  return getEntitlements(planId).canSelectModel;
}

export function canUseIntegration(planId: string | null | undefined): boolean {
  return getEntitlements(planId).canUseIntegrations;
}

export function canEditCode(planId: string | null | undefined): boolean {
  return getEntitlements(planId).canEditCode;
}

export function canUseMobileWrapping(planId: string | null | undefined): boolean {
  return getEntitlements(planId).canUseMobileWrapping;
}

/** Canonical credit display formula (explicit bonus only — never allowance delta). */
export function computeCreditDisplay(input: {
  available: number;
  planAllowance: number;
  explicitBonus: number;
  ledgerUsed?: number;
}) {
  const bonus = Math.max(0, Math.round(input.explicitBonus * 10) / 10);
  const displayedTotal = input.planAllowance + bonus;
  const available = Math.max(0, Math.round(input.available * 10) / 10);
  const used =
    input.ledgerUsed != null && input.ledgerUsed > 0
      ? Math.round(input.ledgerUsed * 10) / 10
      : Math.max(0, Math.round((displayedTotal - available) * 10) / 10);
  return { available, displayedTotal, bonus, used, planAllowance: input.planAllowance };
}
