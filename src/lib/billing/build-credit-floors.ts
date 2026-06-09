/**
 * Build Credit operation floors — never price full builds from raw provider cost alone.
 */
import type { FirstPassTier } from "@/lib/build/first-pass-scope";
import { applyPremiumModelCredits } from "@/lib/billing/premium-model-pricing";
import {
  TARGET_REVENUE_MULTIPLIER,
  USER_CREDITS_PER_USD,
  minimumUserCreditsForProviderCost,
  type GenerationMode,
} from "@/lib/billing/pricing-config";

export type BuildCreditOperationType =
  | "discuss"
  | "tiny_edit"
  | "normal_edit"
  | "ui_polish"
  | "repair"
  | "first_build_small"
  | "first_build_standard"
  | "first_build_advanced"
  | "huge_staged_first_pass"
  | "backlog_continuation";

/** Minimum user Build Credits by operation (before provider×markup×10). */
/** P5.4.4 — +10–15% on high-cost build operations (UX-neutral; fewer actions per allowance). */
export const BUILD_CREDIT_OPERATION_FLOORS: Record<BuildCreditOperationType, number> = {
  discuss: 0.3,
  tiny_edit: 1,
  normal_edit: 2,
  ui_polish: 2,
  repair: 2,
  first_build_small: 4,
  first_build_standard: 6,
  first_build_advanced: 9,
  huge_staged_first_pass: 14,
  backlog_continuation: 2,
};

export type ResolveBuildOperationInput = {
  mode: GenerationMode;
  firstPassTier?: FirstPassTier;
  promptWasHuge?: boolean;
  isContinuation?: boolean;
  editScope?: "tiny" | "normal";
  complexity?: number;
};

export function polishRepairFloorCredits(complexity = 5): number {
  if (complexity >= 7) return 4;
  if (complexity >= 4) return 3;
  return BUILD_CREDIT_OPERATION_FLOORS.ui_polish;
}

export function resolveBuildCreditOperationType(
  input: ResolveBuildOperationInput,
): BuildCreditOperationType {
  if (input.isContinuation) return "backlog_continuation";
  if (input.mode === "discuss") return "discuss";
  if (input.mode === "polish") return "ui_polish";
  if (input.mode === "repair") return "repair";
  if (input.mode === "edit") {
    return input.editScope === "tiny" || (input.complexity ?? 5) <= 3
      ? "tiny_edit"
      : "normal_edit";
  }
  if (input.mode === "full_build" || input.mode === "build") {
    if (input.promptWasHuge) return "huge_staged_first_pass";
    const tier = input.firstPassTier ?? "standard";
    if (tier === "advanced") return "first_build_advanced";
    if (tier === "standard") return "first_build_standard";
    return "first_build_small";
  }
  if (input.mode === "deploy") return "normal_edit";
  return "normal_edit";
}

export function operationMinimumCredits(
  operationType: BuildCreditOperationType,
  complexity = 5,
): number {
  if (operationType === "ui_polish" || operationType === "repair") {
    return polishRepairFloorCredits(complexity);
  }
  return BUILD_CREDIT_OPERATION_FLOORS[operationType];
}

export type AppliedBuildCreditPricing = {
  operationType: BuildCreditOperationType;
  providerCostUsd: number;
  markupMultiplier: number;
  profitableCredits: number;
  operationMinimumCredits: number;
  userCreditsRequired: number;
  minimumFloorApplied: boolean;
};

/**
 * Final charge/reserve credits:
 * max(operation_minimum, ceil(provider_usd × markup_multiplier × USER_CREDITS_PER_USD))
 */
export function applyBuildCreditPricing(input: {
  operationType: BuildCreditOperationType;
  providerCostUsd: number;
  complexity?: number;
  markupMultiplier?: number;
  selectedModelId?: string | null;
}): AppliedBuildCreditPricing {
  const markupMultiplier = input.markupMultiplier ?? TARGET_REVENUE_MULTIPLIER;
  const providerCostUsd = Math.max(0, input.providerCostUsd);
  const profitableCredits = minimumUserCreditsForProviderCost(providerCostUsd);
  const floor = operationMinimumCredits(input.operationType, input.complexity ?? 5);
  let userCreditsRequired = Math.max(floor, profitableCredits);
  if (input.selectedModelId) {
    userCreditsRequired = applyPremiumModelCredits(userCreditsRequired, input.selectedModelId);
  }
  const minimumFloorApplied = userCreditsRequired > profitableCredits + 1e-9;

  return {
    operationType: input.operationType,
    providerCostUsd,
    markupMultiplier,
    profitableCredits,
    operationMinimumCredits: floor,
    userCreditsRequired,
    minimumFloorApplied,
  };
}

export function formatBuildCreditsWhenSuccessful(credits: number): string {
  const rounded = Math.ceil(credits * 10) / 10;
  const text =
    Math.abs(rounded - Math.round(rounded)) < 0.05
      ? String(Math.round(rounded))
      : rounded.toFixed(1);
  return `Uses ${text} Build Credit${rounded === 1 ? "" : "s"} when successful.`;
}

/** Sanity: $1 revenue = 10 user credits at list price. */
export function creditsForOneDollarRevenue(): number {
  return USER_CREDITS_PER_USD;
}
