/**
 * Discuss-mode provider cost guard — admin economics only; never shown to users.
 */
import { pickCheapDiscussModel } from "@/lib/ai/cheap-planner";
import { estimateTokenProviderCostUsd } from "@/lib/credits/token-cost";
import { discussCreditsToCharge } from "@/lib/billing/discuss-credit-pricing";
import { USER_CREDITS_PER_USD } from "@/lib/billing/pricing-config";

/** Max projected provider USD for a single Discuss turn before re-route/block. */
export const DISCUSS_MAX_PROVIDER_COST_USD = 0.005;

export type DiscussGuardInput = {
  modelId: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  mode?: "discuss" | "edit" | "build";
  /** When true, never silently downgrade to a cheap model — user picked this model explicitly. */
  respectManualSelection?: boolean;
};

export type DiscussGuardResult = {
  allowed: boolean;
  projectedProviderCostUsd: number;
  modelId: string;
  action: "ok" | "compress" | "fallback_cheap" | "block_suggest_build";
  userMessage?: string;
  adminNote?: string;
};

const HEAVY_DISCUSS_BLOCK = /claude-opus|claude-sonnet|gpt-5-5|gpt-5-4(?!-mini)|gemini-2-5-pro|gemini-3-1-pro/i;

export function isHeavyDiscussModel(modelId: string): boolean {
  return HEAVY_DISCUSS_BLOCK.test(modelId);
}

export function projectDiscussProviderCost(input: DiscussGuardInput): number {
  return estimateTokenProviderCostUsd(
    input.modelId,
    input.estimatedInputTokens,
    input.estimatedOutputTokens,
  );
}

/**
 * Protect Discuss profitability and prevent accidental heavy context spend.
 */
export function guardDiscussProviderCall(input: DiscussGuardInput): DiscussGuardResult {
  if (input.mode && input.mode !== "discuss") {
    return {
      allowed: true,
      projectedProviderCostUsd: projectDiscussProviderCost(input),
      modelId: input.modelId,
      action: "ok",
    };
  }

  const modelId = input.modelId;
  const projected = projectDiscussProviderCost({ ...input, modelId });
  const manual = input.respectManualSelection === true;

  if (
    !manual &&
    isHeavyDiscussModel(modelId) &&
    !input.modelId.includes("mini") &&
    !input.modelId.includes("flash")
  ) {
    const cheap = pickCheapDiscussModel(null);
    return {
      allowed: true,
      projectedProviderCostUsd: projectDiscussProviderCost({
        ...input,
        modelId: cheap.modelId,
      }),
      modelId: cheap.modelId,
      action: "fallback_cheap",
      adminNote: `Discuss auto-mode rerouted from ${input.modelId} to ${cheap.modelId}`,
    };
  }

  if (!manual && projected > DISCUSS_MAX_PROVIDER_COST_USD) {
    const cheap = pickCheapDiscussModel(null);
    const cheapCost = projectDiscussProviderCost({ ...input, modelId: cheap.modelId });
    if (cheapCost <= DISCUSS_MAX_PROVIDER_COST_USD) {
      return {
        allowed: true,
        projectedProviderCostUsd: cheapCost,
        modelId: cheap.modelId,
        action: "fallback_cheap",
        adminNote: `Discuss cost ${projected.toFixed(4)} > cap; fallback to ${cheap.modelId}`,
      };
    }
    return {
      allowed: false,
      projectedProviderCostUsd: projected,
      modelId: input.modelId,
      action: "block_suggest_build",
      userMessage:
        "This conversation context is too large for Discuss. Try Create or Builder for implementation work.",
      adminNote: `Discuss blocked: projected $${projected.toFixed(4)} exceeds $${DISCUSS_MAX_PROVIDER_COST_USD}`,
    };
  }

  if (!manual) {
    const discussRevenueUsd = discussCreditsToCharge() / USER_CREDITS_PER_USD;
    if (projected > discussRevenueUsd * 0.5) {
      return {
        allowed: true,
        projectedProviderCostUsd: projected,
        modelId,
        action: "compress",
        adminNote: "Discuss context compression recommended",
      };
    }
  }

  return { allowed: true, projectedProviderCostUsd: projected, modelId, action: "ok" };
}
