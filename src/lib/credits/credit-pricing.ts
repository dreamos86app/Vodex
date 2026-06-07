import { estimateProviderCostUsd } from "@/lib/credits/usage-cost";
import { estimateTokenProviderCostUsd } from "@/lib/credits/token-cost";
import { TARGET_REVENUE_MULTIPLIER, USER_CREDITS_PER_USD } from "@/lib/billing/pricing-config";
import {
  quoteGenerationCost,
  creditsFromProviderCostUsd,
  quoteDiscussCost,
  quoteCreateQuestionCost,
  assertProfitableCharge,
} from "@/lib/billing/credit-profit-guard";
import {
  type BuildCreditOperationType,
  applyBuildCreditPricing,
  resolveBuildCreditOperationType,
} from "@/lib/billing/build-credit-floors";

/** @deprecated Use TARGET_REVENUE_MULTIPLIER */
export const DREAMOS_CREDIT_MARKUP = TARGET_REVENUE_MULTIPLIER;

export const CREDIT_UNIT_VALUE_USD = 1 / USER_CREDITS_PER_USD;

export type CreditEstimateInput = {
  mode: "discuss" | "edit" | "build";
  modelId: string;
  provider?: string;
  promptLength?: number;
  expectedFiles?: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
};

export type CreditEstimateResult = {
  creditsMin: number;
  creditsMax: number;
  estimatedProviderCostUsd: number;
};

export function estimateCreditsForOperation(input: CreditEstimateInput): CreditEstimateResult {
  const providerCost = estimateProviderCostUsd(
    input.modelId,
    input.mode,
    input.inputTokens ?? null,
    input.outputTokens ?? null,
  );
  const quote = quoteGenerationCost({
    mode: input.mode === "build" ? "build" : input.mode,
    selectedModel: input.modelId,
    estimatedProviderCostUsd: providerCost,
    promptLength: input.promptLength,
    expectedFiles: input.expectedFiles,
  });

  return {
    creditsMin: quote.userCreditsRequired,
    creditsMax: quote.userCreditsReserved,
    estimatedProviderCostUsd: providerCost,
  };
}

export function calculateCreditsForStagedBuild(input: {
  providerCostUsd: number;
  complexity: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  primaryModelId: string;
  fileCount?: number;
  operationType?: BuildCreditOperationType;
}): ChargeCalculationResult {
  const tokenCost =
    input.inputTokens != null && input.outputTokens != null
      ? estimateTokenProviderCostUsd(input.primaryModelId, input.inputTokens, input.outputTokens)
      : input.providerCostUsd;

  const providerUsd = Math.max(tokenCost, input.providerCostUsd);
  const quote = quoteGenerationCost({
    mode: "full_build",
    selectedModel: input.primaryModelId,
    estimatedProviderCostUsd: providerUsd,
    estimatedInputTokens: input.inputTokens,
    estimatedOutputTokens: input.outputTokens,
    complexity: input.complexity,
    operationType: input.operationType,
  });
  const creditsToCharge = normalizeCreditCharge(quote.userCreditsRequired);

  return {
    creditsToCharge,
    estimatedProviderCostUsd: providerUsd,
    marginMultiplier: quote.adminBreakdown.markup_multiplier,
  };
}

export function normalizeCreditCharge(amount: number): number {
  if (!Number.isFinite(amount) || amount < 0.1) return 0.1;
  return Math.ceil(amount * 10) / 10;
}

/** Billable credits for a completed staged build (respects full_build floors). */
export function resolveStagedBuildChargeCredits(input: {
  chargeCalc: ChargeCalculationResult;
  reservedCredits: number;
  complexity: number;
}): number {
  if (input.reservedCredits <= 0) return 0;
  const opType = resolveBuildCreditOperationType({
    mode: "full_build",
    complexity: input.complexity,
  });
  const pricing = applyBuildCreditPricing({
    operationType: opType,
    providerCostUsd: input.chargeCalc.estimatedProviderCostUsd,
  });
  const floor = pricing.userCreditsRequired;
  const profitable = assertProfitableCharge(
    input.chargeCalc.creditsToCharge,
    input.chargeCalc.estimatedProviderCostUsd,
    opType,
  );
  const billable = profitable.ok
    ? input.chargeCalc.creditsToCharge
    : Math.max(input.chargeCalc.creditsToCharge, floor);
  return Math.min(input.reservedCredits, normalizeCreditCharge(billable));
}

export type ChargeCalculationInput = {
  modelId: string;
  mode: "discuss" | "create_question" | "edit" | "build";
  inputTokens?: number | null;
  outputTokens?: number | null;
  fileCount?: number;
};

export type ChargeCalculationResult = {
  creditsToCharge: number;
  estimatedProviderCostUsd: number;
  marginMultiplier: number;
  operationType?: import("@/lib/billing/build-credit-floors").BuildCreditOperationType;
  minimumFloorApplied?: boolean;
};

export function creditsFromProviderCost(providerCostUsd: number): number {
  return creditsFromProviderCostUsd(providerCostUsd);
}

export function calculateCreditsToCharge(input: ChargeCalculationInput): ChargeCalculationResult {
  const tokenCost =
    input.inputTokens != null && input.outputTokens != null
      ? estimateTokenProviderCostUsd(input.modelId, input.inputTokens, input.outputTokens)
      : estimateProviderCostUsd(input.modelId, input.mode === "build" ? "build" : "discuss", input.inputTokens, input.outputTokens);

  if (input.mode === "discuss") {
    const quote = quoteDiscussCost({
      selectedModel: input.modelId,
      estimatedProviderCostUsd: tokenCost,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
    });
    return {
      creditsToCharge: normalizeCreditCharge(quote.userCreditsRequired),
      estimatedProviderCostUsd: tokenCost,
      marginMultiplier: quote.revenueMultiplier,
      operationType: quote.operationType,
      minimumFloorApplied: quote.adminBreakdown.minimum_floor_applied,
    };
  }

  if (input.mode === "create_question") {
    const quote = quoteCreateQuestionCost({
      selectedModel: input.modelId,
      estimatedProviderCostUsd: tokenCost,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
    });
    return {
      creditsToCharge: normalizeCreditCharge(quote.userCreditsRequired),
      estimatedProviderCostUsd: tokenCost,
      marginMultiplier: quote.revenueMultiplier,
      operationType: quote.operationType,
      minimumFloorApplied: quote.adminBreakdown.minimum_floor_applied,
    };
  }

  const mode = input.mode === "build" ? "full_build" : "edit";
  const quote = quoteGenerationCost({
    mode,
    selectedModel: input.modelId,
    estimatedProviderCostUsd: tokenCost,
    estimatedInputTokens: input.inputTokens,
    estimatedOutputTokens: input.outputTokens,
    complexity: input.mode === "edit" && (input.fileCount ?? 0) <= 1 ? 3 : 5,
    editScope: input.mode === "edit" && (input.fileCount ?? 0) <= 1 ? "tiny" : "normal",
  });

  return {
    creditsToCharge: normalizeCreditCharge(quote.userCreditsRequired),
    estimatedProviderCostUsd: tokenCost,
    marginMultiplier: quote.adminBreakdown.markup_multiplier,
    operationType: quote.operationType,
    minimumFloorApplied: quote.adminBreakdown.minimum_floor_applied,
  };
}
