import { FULL_BUILD_CAP_USD } from "@/lib/ai/cost-budget";
import {
  TARGET_REVENUE_MULTIPLIER,
  USER_CREDIT_FLOORS,
  complexityFloorKey,
  grossMarginFromCharge,
  minimumUserCreditsForProviderCost,
  providerUsdToInternalCredits,
  revenueMultiplierFromCharge,
  USER_CREDITS_PER_USD,
  type GenerationMode,
} from "@/lib/billing/pricing-config";
import { estimateProviderCostUsd } from "@/lib/credits/usage-cost";
import { estimateTokenProviderCostUsd } from "@/lib/credits/token-cost";

export type QuoteGenerationCostInput = {
  mode: GenerationMode;
  complexity?: number;
  selectedModel: string;
  estimatedProviderCostUsd?: number;
  estimatedInputTokens?: number | null;
  estimatedOutputTokens?: number | null;
  promptLength?: number;
  expectedFiles?: number;
  userPlan?: string | null;
  reserveBuffer?: number;
};

export type GenerationCostQuote = {
  userCreditsRequired: number;
  userCreditsReserved: number;
  internalCostCredits: number;
  /** Actual revenue_usd / provider_cost_usd */
  revenueMultiplier: number;
  estimatedGrossMargin: number;
  providerHardCapUsd: number;
  estimatedProviderCostUsd: number;
  floorReason: string;
  safeToRun: boolean;
  userFacingLabel: string;
  adminBreakdown: {
    productFloorCredits: number;
    minimumProfitableCredits: number;
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

function promptBump(mode: GenerationMode, promptLength: number): number {
  if (mode !== "build" && mode !== "full_build") return 0;
  if (promptLength <= 800) return 0;
  return Math.min(8, Math.floor(promptLength / 400));
}

function fileBump(mode: GenerationMode, expectedFiles: number): number {
  if (mode !== "build" && mode !== "full_build") return 0;
  if (expectedFiles <= 6) return 0;
  return Math.min(10, Math.floor(expectedFiles / 3));
}

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

/** Discuss uses ~5× provider cost target; still enforces global 3× minimum. */
export const DISCUSS_TARGET_REVENUE_MULTIPLIER = 5;

export function quoteDiscussCost(input: {
  selectedModel: string;
  estimatedProviderCostUsd?: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
}): GenerationCostQuote {
  const providerUsd =
    input.estimatedProviderCostUsd != null && input.estimatedProviderCostUsd > 0
      ? input.estimatedProviderCostUsd
      : input.inputTokens != null && input.outputTokens != null
        ? estimateTokenProviderCostUsd(input.selectedModel, input.inputTokens, input.outputTokens)
        : Math.min(estimateProviderCostUsd(input.selectedModel, "discuss"), 0.012);

  const minProfitable = minimumUserCreditsForProviderCost(providerUsd);
  const discussTarget = Math.max(
    1,
    Math.ceil(providerUsd * DISCUSS_TARGET_REVENUE_MULTIPLIER * USER_CREDITS_PER_USD),
  );
  const userCreditsRequired = Math.max(1, Math.min(discussTarget, Math.max(minProfitable, 1)));

  const revenueMultiplier = revenueMultiplierFromCharge(userCreditsRequired, providerUsd);
  const grossMargin = grossMarginFromCharge(userCreditsRequired, providerUsd);

  return {
    userCreditsRequired,
    userCreditsReserved: userCreditsRequired,
    internalCostCredits: providerUsdToInternalCredits(providerUsd),
    revenueMultiplier,
    estimatedGrossMargin: grossMargin,
    providerHardCapUsd: 0.012,
    estimatedProviderCostUsd: providerUsd,
    floorReason: userCreditsRequired <= 1 ? "discuss_microcharge" : "discuss_5x_target",
    safeToRun: userCreditsRequired >= minProfitable || minProfitable <= 1,
    userFacingLabel: `Conversation · ${userCreditsRequired} credit${userCreditsRequired === 1 ? "" : "s"}`,
    adminBreakdown: {
      productFloorCredits: USER_CREDIT_FLOORS.discuss,
      minimumProfitableCredits: minProfitable,
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

export function quoteGenerationCost(input: QuoteGenerationCostInput): GenerationCostQuote {
  if (input.mode === "discuss") {
    return quoteDiscussCost({
      selectedModel: input.selectedModel,
      estimatedProviderCostUsd: input.estimatedProviderCostUsd,
      inputTokens: input.estimatedInputTokens,
      outputTokens: input.estimatedOutputTokens,
    });
  }

  const complexity = Math.min(10, Math.max(1, input.complexity ?? 5));
  const providerUsd = resolveProviderCostUsd(input);
  const internalCostCredits = providerUsdToInternalCredits(providerUsd);
  const minimumProfitable = minimumUserCreditsForProviderCost(providerUsd);
  const floorKey = complexityFloorKey(input.mode, complexity);
  const productFloor = USER_CREDIT_FLOORS[floorKey];
  const pBump = promptBump(input.mode, input.promptLength ?? 0);
  const fBump = fileBump(input.mode, input.expectedFiles ?? 0);
  const baseRequired = Math.max(productFloor, minimumProfitable) + pBump + fBump;
  const buffer = input.reserveBuffer ?? (input.mode === "build" || input.mode === "full_build" ? 1.15 : 1);
  const userCreditsRequired = Math.max(1, Math.ceil(baseRequired));
  const userCreditsReserved = Math.max(
    userCreditsRequired,
    Math.ceil(userCreditsRequired * buffer),
  );

  const revenueMultiplier = revenueMultiplierFromCharge(userCreditsRequired, providerUsd);
  const grossMargin = grossMarginFromCharge(userCreditsRequired, providerUsd);

  const modeLabel =
    input.mode === "full_build"
      ? "Full app build"
      : input.mode === "build"
        ? "App build"
        : input.mode === "edit"
          ? "Targeted edit"
          : input.mode === "deploy"
          ? "Deploy preparation"
          : input.mode === "polish"
            ? "Polish pass"
            : input.mode === "repair"
              ? "AI repair"
              : "Conversation";

  let floorReason = "combined";
  if (userCreditsRequired === productFloor + pBump + fBump && minimumProfitable <= productFloor) {
    floorReason = `product_floor:${floorKey}`;
  } else if (userCreditsRequired === minimumProfitable + pBump + fBump) {
    floorReason = "target_revenue_3x";
  }

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
      minimumProfitable === 0 ||
      revenueMultiplier >= TARGET_REVENUE_MULTIPLIER - 0.001,
    userFacingLabel: `${modeLabel} · ~${userCreditsRequired} credits`,
    adminBreakdown: {
      productFloorCredits: productFloor,
      minimumProfitableCredits: minimumProfitable,
      promptBump: pBump,
      fileBump: fBump,
      bufferApplied: buffer,
      revenueUsd: userCreditsRequired / 10,
      costUsd: providerUsd,
      modelId: input.selectedModel,
      mode: input.mode,
      complexity,
    },
  };
}

export function assertProfitableCharge(
  userCredits: number,
  providerCostUsd: number,
): { ok: boolean; reason?: string } {
  const minUser = minimumUserCreditsForProviderCost(providerCostUsd);
  if (providerCostUsd > 0 && userCredits < minUser) {
    return {
      ok: false,
      reason: `Charge ${userCredits} below ${TARGET_REVENUE_MULTIPLIER}× revenue minimum ${minUser} (provider $${providerCostUsd.toFixed(4)})`,
    };
  }
  return { ok: true };
}

export function creditsFromProviderCostUsd(providerCostUsd: number): number {
  return quoteGenerationCost({
    mode: "discuss",
    selectedModel: "gemini-flash",
    estimatedProviderCostUsd: providerCostUsd,
  }).userCreditsRequired;
}

/** @deprecated Use revenueMultiplier on quote */
export function estimatedGrossMargin(userCredits: number, providerCostUsd: number): number {
  return grossMarginFromCharge(userCredits, providerCostUsd);
}
