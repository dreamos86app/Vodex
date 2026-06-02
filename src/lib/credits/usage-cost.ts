/**
 * Provider cost estimates (USD) from per-model $/1M input/output rates.
 * User credits: provider_usd × TARGET_REVENUE_MULTIPLIER × USER_CREDITS_PER_USD (see pricing-config).
 */

import { estimateTokenProviderCostUsd } from "@/lib/credits/token-cost";

/** Typical token envelope when usage is not known yet. */
export function defaultTokenEnvelopeForMode(mode: string): { input: number; output: number } {
  if (mode === "discuss") return { input: 2000, output: 800 };
  if (mode === "edit") return { input: 3000, output: 2000 };
  if (mode === "build") return { input: 4000, output: 12000 };
  return { input: 2000, output: 4000 };
}

/** Treat 0 / missing token counts as unknown — use mode envelope for admin cost estimates. */
export function effectiveTokenCountsForMode(
  mode: string,
  tokensInput?: number | null,
  tokensOutput?: number | null,
): { input: number; output: number } {
  const defaults = defaultTokenEnvelopeForMode(mode);
  const input =
    tokensInput != null && tokensInput > 0 ? tokensInput : defaults.input;
  const output =
    tokensOutput != null && tokensOutput > 0 ? tokensOutput : defaults.output;
  return { input, output };
}

export function estimateProviderCostUsd(
  modelId: string,
  mode: string,
  tokensInput?: number | null,
  tokensOutput?: number | null,
): number {
  const { input, output } = effectiveTokenCountsForMode(mode, tokensInput, tokensOutput);
  return estimateTokenProviderCostUsd(modelId, input, output);
}

/** Prefer logged provider USD; never treat explicit 0 as “known” when tokens are absent. */
export function resolveRowProviderCostUsd(input: {
  modelId: string;
  mode: string;
  tokensInput?: number | null;
  tokensOutput?: number | null;
  metadata?: Record<string, unknown> | null;
}): number {
  const raw = input.metadata?.provider_cost_usd;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return raw;
  }
  if (raw && typeof raw === "object" && "costUsd" in raw) {
    const nested = (raw as { costUsd?: number }).costUsd;
    if (typeof nested === "number" && Number.isFinite(nested) && nested > 0) {
      return nested;
    }
  }
  return estimateProviderCostUsd(
    input.modelId,
    input.mode,
    input.tokensInput,
    input.tokensOutput,
  );
}

export function estimateOwnerRevenueUsd(creditsCharged: number): number {
  return creditsCharged / 50;
}

export function estimateOwnerMarginUsd(
  creditsCharged: number,
  providerCostUsd: number,
): number {
  return estimateOwnerRevenueUsd(creditsCharged) - providerCostUsd;
}
