import { calculateCredits, MARGIN_MULTIPLIER, CREDITS_PER_USD } from "@/lib/credits/cost-engine";
import { estimateProviderCostUsd } from "@/lib/credits/usage-cost";

/** User-facing markup: charge = max(mode floor, provider cost × this factor). */
export const DREAMOS_CREDIT_MARKUP = MARGIN_MULTIPLIER;

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
  const base = calculateCredits(input.modelId, input.mode);
  const promptBump =
    input.mode === "build" && (input.promptLength ?? 0) > 800
      ? Math.min(8, Math.floor((input.promptLength ?? 0) / 400))
      : 0;
  const fileBump =
    input.mode === "build" && (input.expectedFiles ?? 0) > 6
      ? Math.min(10, Math.floor((input.expectedFiles ?? 0) / 3))
      : 0;

  const providerCost = estimateProviderCostUsd(
    input.modelId,
    input.mode,
    input.inputTokens ?? null,
    input.outputTokens ?? null,
  );
  const fromUsage = Math.max(
    1,
    Math.ceil(providerCost * DREAMOS_CREDIT_MARKUP * CREDITS_PER_USD),
  );

  const creditsMin = base + promptBump;
  const creditsMax = Math.max(creditsMin, fromUsage + fileBump);

  return {
    creditsMin,
    creditsMax,
    estimatedProviderCostUsd: providerCost,
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

/** Credits charged after successful AI work (3× provider cost vs mode floor). */
export function calculateCreditsToCharge(input: ChargeCalculationInput): ChargeCalculationResult {
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

  return {
    creditsToCharge: normalizeCreditCharge(est.creditsMax + fileBump),
    estimatedProviderCostUsd: est.estimatedProviderCostUsd,
    marginMultiplier: DREAMOS_CREDIT_MARKUP,
  };
}
