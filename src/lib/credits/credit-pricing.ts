import { calculateCredits } from "@/lib/credits/cost-engine";
import { estimateProviderCostUsd } from "@/lib/credits/usage-cost";
import { estimateTokenProviderCostUsd } from "@/lib/credits/token-cost";
import type { AiOperationType } from "@/lib/ai/operation-types";
import {
  TARGET_REVENUE_MULTIPLIER,
  USER_CREDITS_PER_USD,
} from "@/lib/billing/pricing-config";

import {
  quoteGenerationCost,
  creditsFromProviderCostUsd,
  quoteDiscussCost,
} from "@/lib/billing/credit-profit-guard";

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
  const legacy = calculateCredits(input.modelId, input.mode);
  const creditsMin = Math.max(legacy, quote.userCreditsRequired);
  const creditsMax = Math.max(creditsMin, quote.userCreditsReserved);

  return {
    creditsMin,
    creditsMax,
    estimatedProviderCostUsd: providerCost,
  };
}

export function calculateCreditsForStagedBuild(input: {
  providerCostUsd: number;
  complexity: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  primaryModelId: string;
}): ChargeCalculationResult {
  const tokenCost =
    input.inputTokens != null && input.outputTokens != null
      ? estimateTokenProviderCostUsd(input.primaryModelId, input.inputTokens, input.outputTokens)
      : input.providerCostUsd;

  let floor = OP_MIN_CREDITS.build_simple ?? 8;
  if (input.complexity >= 8) floor = OP_MIN_CREDITS.build_hard ?? 35;
  else if (input.complexity >= 5) floor = OP_MIN_CREDITS.build_medium ?? 18;

  const quote = quoteGenerationCost({
    mode: "full_build",
    complexity: input.complexity,
    selectedModel: input.primaryModelId,
    estimatedProviderCostUsd: Math.max(tokenCost, input.providerCostUsd),
  });
  return {
    creditsToCharge: normalizeCreditCharge(Math.max(floor, quote.userCreditsRequired)),
    estimatedProviderCostUsd: Math.max(tokenCost, input.providerCostUsd),
    marginMultiplier: quote.revenueMultiplier,
  };
}

export function normalizeCreditCharge(amount: number): number {
  if (!Number.isFinite(amount) || amount < 1) return 1;
  return Math.ceil(amount);
}

export type ChargeCalculationInput = {
  modelId: string;
  mode: "discuss" | "edit" | "build";
  inputTokens?: number | null;
  outputTokens?: number | null;
  fileCount?: number;
};

export type ChargeCalculationResult = {
  creditsToCharge: number;
  estimatedProviderCostUsd: number;
  marginMultiplier: number;
};

const OP_MIN_CREDITS: Partial<Record<AiOperationType | "build_simple" | "build_medium" | "build_hard", number>> = {
  discuss_short: 1,
  discuss_deep: 2,
  build_plan: 3,
  app_identity: 2,
  build_simple: 8,
  build_medium: 18,
  build_hard: 35,
};

export function creditsFromProviderCost(providerCostUsd: number): number {
  return creditsFromProviderCostUsd(providerCostUsd);
}

export function calculateCreditsToCharge(input: ChargeCalculationInput): ChargeCalculationResult {
  if (input.mode === "discuss") {
    const tokenCost =
      input.inputTokens != null && input.outputTokens != null
        ? estimateTokenProviderCostUsd(input.modelId, input.inputTokens, input.outputTokens)
        : estimateProviderCostUsd(input.modelId, "discuss", input.inputTokens, input.outputTokens);
    const quote = quoteDiscussCost({
      selectedModel: input.modelId,
      estimatedProviderCostUsd: tokenCost,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
    });
    return {
      creditsToCharge: quote.userCreditsRequired,
      estimatedProviderCostUsd: tokenCost,
      marginMultiplier: quote.revenueMultiplier,
    };
  }

  const est = estimateCreditsForOperation({
    mode: input.mode,
    modelId: input.modelId,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    expectedFiles: input.fileCount,
  });

  const fileBump =
    input.mode === "build" && (input.fileCount ?? 0) > 8
      ? Math.min(12, Math.floor((input.fileCount ?? 0) / 4))
      : 0;

  const fromProvider =
    input.inputTokens != null && input.outputTokens != null
      ? creditsFromProviderCost(
          estimateTokenProviderCostUsd(
            input.modelId,
            input.inputTokens,
            input.outputTokens,
          ),
        )
      : est.creditsMax;

  return {
    creditsToCharge: normalizeCreditCharge(Math.max(est.creditsMin, fromProvider) + fileBump),
    estimatedProviderCostUsd: est.estimatedProviderCostUsd,
    marginMultiplier: TARGET_REVENUE_MULTIPLIER,
  };
}
