/** Action Credits — central pricing engine (runtime, separate from Build Credits). */

import {
  ACTION_PROVIDER_USD_PER_CREDIT,
  ACTION_CREDITS_PER_DOLLAR,
  actionCreditRevenueUsdBaseline,
} from "@/lib/billing/plan-credit-economics";
import {
  floorForRuntimeAction,
  isFreeRuntimeAction,
  resolveRuntimeActionType,
} from "@/lib/action-credits/action-catalog";

export { ACTION_PROVIDER_USD_PER_CREDIT, ACTION_CREDITS_PER_DOLLAR };

/** Minimum provider-cost multiple for Action Credit quotes (P5.3). */
export const MIN_ACTION_MARGIN_MULTIPLIER = 5;
/** @deprecated */
export const ACTION_CREDITS_PER_USD = 1 / ACTION_PROVIDER_USD_PER_CREDIT;

export type ActionCreditQuoteInput = {
  actionType: string;
  providerCostUsd?: number | null;
  /** Override floor for dynamic actions (speech/video/workflows). */
  dynamicFloor?: number | null;
};

export type ActionCreditQuote = {
  actionType: string;
  canonicalType: string;
  providerCostUsd: number;
  floor: number;
  protectedMinimum: number;
  finalActionCredits: number;
  multiplierAchieved: number;
  isFree: boolean;
};

export function creditsFromProviderCostUsd(providerCostUsd: number): number {
  if (providerCostUsd <= 0) return 0;
  return Math.ceil(providerCostUsd / ACTION_PROVIDER_USD_PER_CREDIT);
}

export function quoteActionCredits(input: ActionCreditQuoteInput): ActionCreditQuote {
  const canonical = resolveRuntimeActionType(input.actionType);
  const floor = input.dynamicFloor ?? floorForRuntimeAction(canonical);
  const isFree = isFreeRuntimeAction(canonical) && floor <= 0;

  if (isFree) {
    return {
      actionType: input.actionType,
      canonicalType: canonical,
      providerCostUsd: 0,
      floor: 0,
      protectedMinimum: 0,
      finalActionCredits: 0,
      multiplierAchieved: 0,
      isFree: true,
    };
  }

  const providerCostUsd = Math.max(0, Number(input.providerCostUsd ?? 0) || 0);
  const revenuePerCredit = actionCreditRevenueUsdBaseline();
  const protectedMinimum =
    providerCostUsd > 0
      ? Math.ceil((providerCostUsd * MIN_ACTION_MARGIN_MULTIPLIER) / revenuePerCredit)
      : 0;
  const poolMinimum = creditsFromProviderCostUsd(providerCostUsd);
  const finalActionCredits = Math.max(floor, protectedMinimum, poolMinimum);
  const impliedRevenueUsd = finalActionCredits * revenuePerCredit;
  const multiplierAchieved =
    providerCostUsd > 0 ? impliedRevenueUsd / providerCostUsd : MIN_ACTION_MARGIN_MULTIPLIER;

  return {
    actionType: input.actionType,
    canonicalType: canonical,
    providerCostUsd,
    floor,
    protectedMinimum,
    finalActionCredits,
    multiplierAchieved,
    isFree: false,
  };
}

/** @deprecated use quoteActionCredits */
export function minimumActionCreditsForProviderCost(
  actionType: string,
  providerCostUsd?: number | null,
): number {
  return quoteActionCredits({ actionType, providerCostUsd }).finalActionCredits;
}

/** Platform admin OTP / internal notifications — not metered. */
export function isExemptPlatformAction(metadata?: { exempt?: boolean; source?: string }): boolean {
  if (metadata?.exempt) return true;
  if (metadata?.source === "admin_otp") return true;
  if (metadata?.source === "platform_contact_notify") return true;
  return false;
}
