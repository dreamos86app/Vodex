import { FULL_BUILD_CAP_USD } from "@/lib/ai/cost-budget";
import type { FirstPassTier } from "@/lib/build/first-pass-scope";
import {
  applyBuildCreditPricing,
  formatBuildCreditsWhenSuccessful,
  resolveBuildCreditOperationType,
  type BuildCreditOperationType,
} from "@/lib/billing/build-credit-floors";
import {
  TARGET_REVENUE_MULTIPLIER,
  grossMarginFromCharge,
  providerUsdToInternalCredits,
  revenueMultiplierFromCharge,
  USER_CREDITS_PER_USD,
  type GenerationMode,
} from "@/lib/billing/pricing-config";
import {
  discussCreditsToCharge,
  DISCUSS_BC_TIER_PROTECTED,
} from "@/lib/billing/discuss-credit-pricing";
import { estimateProviderCostUsd } from "@/lib/credits/usage-cost";
import { estimateTokenProviderCostUsd } from "@/lib/credits/token-cost";

/** Pricing policy id — discuss tiered 0.3/0.4 BC after successful discuss. */
export const DISCUSS_CREDIT_POLICY_ID = "discuss_tiered_0.3_0.4";

export function discussFlatCreditsOnSuccess(providerCostUsd?: number): number {
  return discussCreditsToCharge({ providerCostUsd });
}

export type QuoteGenerationCostInput = {
  mode: GenerationMode;
  complexity?: number;
  selectedModel: string;
  estimatedProviderCostUsd?: number;
  estimatedInputTokens?: number | null;
  estimatedOutputTokens?: number | null;
  promptLength?: number;
  promptWasCompressed?: boolean;
  expectedFiles?: number;
  userPlan?: string | null;
  reserveBuffer?: number;
  /** Override auto-detected operation floor */
  operationType?: BuildCreditOperationType;
  firstPassTier?: FirstPassTier;
  isContinuation?: boolean;
  editScope?: "tiny" | "normal";
};

export type GenerationCostQuote = {
  userCreditsRequired: number;
  userCreditsReserved: number;
  internalCostCredits: number;
  revenueMultiplier: number;
  estimatedGrossMargin: number;
  providerHardCapUsd: number;
  estimatedProviderCostUsd: number;
  floorReason: string;
  safeToRun: boolean;
  userFacingLabel: string;
  operationType: BuildCreditOperationType;
  adminBreakdown: {
    operationType: BuildCreditOperationType;
    productFloorCredits: number;
    minimumProfitableCredits: number;
    minimum_floor_applied: boolean;
    markup_multiplier: number;
    promptBump: number;
    fileBump: number;
    bufferApplied: number;
    revenueUsd: number;
    costUsd: number;
    modelId: string;
    mode: GenerationMode;
    complexity: number;
  };
};

function resolveProviderCostUsd(input: QuoteGenerationCostInput): number {
  if (input.estimatedProviderCostUsd != null && input.estimatedProviderCostUsd > 0) {
    return Math.min(input.estimatedProviderCostUsd, providerHardCapForMode(input.mode));
  }
  if (
    input.estimatedInputTokens != null &&
    input.estimatedOutputTokens != null &&
    input.estimatedInputTokens > 0
  ) {
    return Math.min(
      estimateTokenProviderCostUsd(
        input.selectedModel,
        input.estimatedInputTokens,
        input.estimatedOutputTokens,
      ),
      providerHardCapForMode(input.mode),
    );
  }
  const modeForEst =
    input.mode === "full_build"
      ? "build"
      : input.mode === "deploy" || input.mode === "polish"
        ? "edit"
        : input.mode;
  return Math.min(
    estimateProviderCostUsd(input.selectedModel, modeForEst as "discuss" | "edit" | "build"),
    providerHardCapForMode(input.mode),
  );
}

export function providerHardCapForMode(mode: GenerationMode): number {
  if (mode === "full_build" || mode === "build") return FULL_BUILD_CAP_USD;
  if (mode === "deploy") return 0.05;
  return 0.02;
}

function resolveOperation(input: QuoteGenerationCostInput): BuildCreditOperationType {
  if (input.operationType) return input.operationType;
  return resolveBuildCreditOperationType({
    mode: input.mode,
    firstPassTier: input.firstPassTier,
    promptWasHuge: input.promptWasCompressed,
    isContinuation: input.isContinuation,
    editScope: input.editScope,
    complexity: input.complexity,
  });
}

function quoteWithFloors(
  input: QuoteGenerationCostInput & { mode: GenerationMode },
): GenerationCostQuote {
  const complexity = Math.min(10, Math.max(1, input.complexity ?? 5));
  const providerUsd = resolveProviderCostUsd(input);
  const operationType = resolveOperation(input);
  const applied = applyBuildCreditPricing({
    operationType,
    providerCostUsd: providerUsd,
    complexity,
    selectedModelId: input.selectedModel,
  });

  const userCreditsRequired = applied.userCreditsRequired;
  const buffer = input.reserveBuffer ?? 1.1;
  const userCreditsReserved = Math.max(
    userCreditsRequired,
    Math.ceil(userCreditsRequired * buffer),
  );
  const internalCostCredits = providerUsdToInternalCredits(providerUsd);
  const revenueMultiplier = revenueMultiplierFromCharge(userCreditsRequired, providerUsd);
  const grossMargin = grossMarginFromCharge(userCreditsRequired, providerUsd);

  const floorReason = applied.minimumFloorApplied
    ? `operation_floor_${operationType}`
    : "provider_markup";

  return {
    userCreditsRequired,
    userCreditsReserved,
    internalCostCredits,
    revenueMultiplier,
    estimatedGrossMargin: grossMargin,
    providerHardCapUsd: providerHardCapForMode(input.mode),
    estimatedProviderCostUsd: providerUsd,
    floorReason,
    safeToRun:
      applied.profitableCredits === 0 ||
      revenueMultiplier >= TARGET_REVENUE_MULTIPLIER - 0.001 ||
      applied.minimumFloorApplied,
    userFacingLabel: formatBuildCreditsWhenSuccessful(userCreditsRequired),
    operationType,
    adminBreakdown: {
      operationType,
      productFloorCredits: applied.operationMinimumCredits,
      minimumProfitableCredits: applied.profitableCredits,
      minimum_floor_applied: applied.minimumFloorApplied,
      markup_multiplier: applied.markupMultiplier,
      promptBump: 0,
      fileBump: 0,
      bufferApplied: buffer,
      revenueUsd: userCreditsRequired / USER_CREDITS_PER_USD,
      costUsd: providerUsd,
      modelId: input.selectedModel,
      mode: input.mode,
      complexity,
    },
  };
}

/** Discuss / create-question — tiered 0.3/0.4 BC with 5x margin guard. */
export function quoteDiscussCost(input: {
  selectedModel: string;
  estimatedProviderCostUsd?: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
}): GenerationCostQuote {
  const providerUsd = resolveProviderCostUsd({
    mode: "discuss",
    selectedModel: input.selectedModel,
    estimatedProviderCostUsd: input.estimatedProviderCostUsd,
    estimatedInputTokens: input.inputTokens,
    estimatedOutputTokens: input.outputTokens,
    complexity: 1,
  });
  const userCreditsRequired = discussCreditsToCharge({
    providerCostUsd: providerUsd,
    inputTokens: input.inputTokens ?? undefined,
    outputTokens: input.outputTokens ?? undefined,
  });
  const revenueMultiplier = revenueMultiplierFromCharge(userCreditsRequired, providerUsd);
  const grossMargin = grossMarginFromCharge(userCreditsRequired, providerUsd);

  return {
    userCreditsRequired,
    userCreditsReserved: userCreditsRequired,
    internalCostCredits: providerUsdToInternalCredits(providerUsd),
    revenueMultiplier,
    estimatedGrossMargin: grossMargin,
    providerHardCapUsd: providerHardCapForMode("discuss"),
    estimatedProviderCostUsd: providerUsd,
    floorReason: userCreditsRequired <= DISCUSS_BC_TIER_PROTECTED ? "discuss_tier_standard" : "discuss_tier_protected",
    safeToRun: revenueMultiplier >= TARGET_REVENUE_MULTIPLIER - 0.001,
    userFacingLabel: formatBuildCreditsWhenSuccessful(userCreditsRequired),
    operationType: "discuss",
    adminBreakdown: {
      operationType: "discuss",
      productFloorCredits: userCreditsRequired,
      minimumProfitableCredits: userCreditsRequired,
      minimum_floor_applied: true,
      markup_multiplier: TARGET_REVENUE_MULTIPLIER,
      promptBump: 0,
      fileBump: 0,
      bufferApplied: 1,
      revenueUsd: userCreditsRequired / USER_CREDITS_PER_USD,
      costUsd: providerUsd,
      modelId: input.selectedModel,
      mode: "discuss",
      complexity: 1,
    },
  };
}

export function quoteCreateQuestionCost(input: {
  selectedModel: string;
  estimatedProviderCostUsd?: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
}): GenerationCostQuote {
  return quoteWithFloors({
    mode: "discuss",
    selectedModel: input.selectedModel,
    estimatedProviderCostUsd: input.estimatedProviderCostUsd,
    estimatedInputTokens: input.inputTokens,
    estimatedOutputTokens: input.outputTokens,
    operationType: "discuss",
    complexity: 1,
  });
}

export function quoteGenerationCost(input: QuoteGenerationCostInput): GenerationCostQuote {
  if (input.mode === "discuss") {
    return quoteDiscussCost({
      selectedModel: input.selectedModel,
      estimatedProviderCostUsd: input.estimatedProviderCostUsd,
      inputTokens: input.estimatedInputTokens,
      outputTokens: input.estimatedOutputTokens,
    });
  }
  return quoteWithFloors(input);
}

export function assertProfitableCharge(
  userCredits: number,
  providerCostUsd: number,
  operationType?: BuildCreditOperationType,
): { ok: boolean; reason?: string } {
  const applied = applyBuildCreditPricing({
    operationType: operationType ?? "normal_edit",
    providerCostUsd,
  });
  if (userCredits < applied.userCreditsRequired - 1e-9) {
    return {
      ok: false,
      reason: `Charge ${userCredits} below required ${applied.userCreditsRequired} (floor ${applied.operationMinimumCredits}, profitable ${applied.profitableCredits})`,
    };
  }
  return { ok: true };
}

export function creditsFromProviderCostUsd(
  providerCostUsd: number,
  operationType: BuildCreditOperationType = "normal_edit",
): number {
  return applyBuildCreditPricing({ operationType, providerCostUsd }).userCreditsRequired;
}

/** @deprecated Use revenueMultiplier on quote */
export function estimatedGrossMargin(userCredits: number, providerCostUsd: number): number {
  return grossMarginFromCharge(userCredits, providerCostUsd);
}
