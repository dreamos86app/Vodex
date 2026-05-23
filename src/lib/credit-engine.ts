/**
 * DreamOS86 Credit Engine
 *
 * Converts real provider API costs into user-facing credits.
 *
 * Architecture:
 *   1. Look up the provider's raw USD cost per token
 *   2. Apply mode overhead (Discuss is cheapest, Build is most expensive)
 *   3. Apply platform multiplier (infrastructure + margin, targeting ~3x)
 *   4. Normalize to the nearest clean UX number
 *
 * INTERNAL — never expose raw_usd_cost or multipliers to users.
 */

// ─── Provider token costs (USD per 1M tokens, as of 2026) ────────────────────
// Source: public provider pricing pages. Update as pricing changes.

interface ModelPricing {
  inputPerMillion: number;   // USD per 1M input tokens
  outputPerMillion: number;  // USD per 1M output tokens
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  // Anthropic
  "claude-opus":          { inputPerMillion: 15.00,  outputPerMillion: 75.00  },
  "claude-sonnet":        { inputPerMillion:  3.00,  outputPerMillion: 15.00  },
  "claude-haiku":         { inputPerMillion:  0.80,  outputPerMillion:  4.00  },
  // Mapped chat view IDs
  "claude-3-5-sonnet":    { inputPerMillion:  3.00,  outputPerMillion: 15.00  },
  "claude-3-5-haiku":     { inputPerMillion:  0.80,  outputPerMillion:  4.00  },
  // OpenAI
  "gpt-4o":               { inputPerMillion:  2.50,  outputPerMillion: 10.00  },
  "gpt-4-5":              { inputPerMillion:  5.00,  outputPerMillion: 20.00  },
  "gpt-4o-mini":          { inputPerMillion:  0.15,  outputPerMillion:  0.60  },
  // Google
  "gemini-pro":           { inputPerMillion:  1.25,  outputPerMillion:  5.00  },
  "gemini-flash":         { inputPerMillion:  0.075, outputPerMillion:  0.30  },
  "gemini-2-0-flash":     { inputPerMillion:  0.075, outputPerMillion:  0.30  },
  // xAI
  "grok-3":               { inputPerMillion:  3.00,  outputPerMillion: 15.00  },
  // DeepSeek
  "deepseek-r1":          { inputPerMillion:  0.55,  outputPerMillion:  2.19  },
};

// Fallback pricing when model is unknown
const FALLBACK_PRICING: ModelPricing = { inputPerMillion: 3.00, outputPerMillion: 15.00 };

// ─── Mode overhead multipliers ────────────────────────────────────────────────

const MODE_MULTIPLIER: Record<string, number> = {
  discuss: 1.0,   // raw inference only
  edit:    1.5,   // inference + context assembly
  agent:   2.5,   // multi-step orchestration + tool calls
  build:   4.0,   // compilation + deployment + signing pipeline
};

// ─── Platform multiplier ─────────────────────────────────────────────────────
// Covers: infrastructure, caching, routing, storage, orchestration, margin.
// Targets ~3x overall after mode overhead.

const PLATFORM_MULTIPLIER = 3.0;

// ─── Credit rounding ──────────────────────────────────────────────────────────
// Round to the nearest 0.5 — keeps values human-readable without fake precision.
//
//   0.42 → 0.5   (nearest half)
//   1.12 → 1.0   (nearest half)
//   6.8  → 7.0   (nearest half)
//   4.2  → 4.0   (nearest half)
//
// Minimum displayed value: 0.5 credits (never 0 for a real generation).

function roundToClean(raw: number): number {
  if (raw <= 0) return 0.5;
  const snapped = Math.round(raw * 2) / 2;
  return Math.max(snapped, 0.5);
}

// Convert USD cost → credits
// 1 credit = $0.001 USD base (before platform multiplier is applied)
const USD_PER_CREDIT = 0.001;

// ─── Public API ───────────────────────────────────────────────────────────────

export interface CreditCalculation {
  credits: number;         // final user-facing rounded credits
  creditsExact: number;    // exact unrounded amount (for analytics/logging)
  mode: string;
  modelId: string;
}

/**
 * Calculate credits consumed for a generation.
 *
 * @param modelId    - Provider model identifier
 * @param inputTokens  - Prompt tokens consumed
 * @param outputTokens - Completion tokens generated
 * @param mode       - AI mode: discuss | edit | agent | build
 */
export function calculateCreditsUsed(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  mode: "discuss" | "edit" | "agent" | "build" = "discuss",
): CreditCalculation {
  const pricing = MODEL_PRICING[modelId] ?? FALLBACK_PRICING;

  // Raw provider USD cost
  const rawUsd =
    (inputTokens / 1_000_000) * pricing.inputPerMillion +
    (outputTokens / 1_000_000) * pricing.outputPerMillion;

  // Apply mode overhead
  const modeMultiplier = MODE_MULTIPLIER[mode] ?? MODE_MULTIPLIER.discuss;
  const adjustedUsd = rawUsd * modeMultiplier;

  // Apply platform multiplier
  const platformUsd = adjustedUsd * PLATFORM_MULTIPLIER;

  // Convert to credits (exact)
  const creditsExact = platformUsd / USD_PER_CREDIT;

  // Round to clean UX number
  const credits = roundToClean(creditsExact);

  return { credits, creditsExact, mode, modelId };
}

/**
 * Estimate credits for a message before sending (based on approximate token count).
 * Used to check if the user has enough credits.
 *
 * @param prompt     - User prompt text
 * @param modelId    - Model to use
 * @param mode       - AI mode
 */
export function estimateCredits(
  prompt: string,
  modelId: string,
  mode: "discuss" | "edit" | "agent" | "build" = "discuss",
): number {
  // Rough: 1 token ≈ 4 characters, estimate 3x output:input ratio for generation
  const estimatedInputTokens = Math.ceil(prompt.length / 4);
  const estimatedOutputTokens = estimatedInputTokens * 3;
  return calculateCreditsUsed(modelId, estimatedInputTokens, estimatedOutputTokens, mode).credits;
}

/**
 * Format credits for display.
 * - Whole numbers: "1", "7", "200"
 * - Half-steps: "0.5", "1.5", "4.5"
 * - Large values: "1.2k"
 */
export function formatCredits(credits: number): string {
  if (credits >= 1000) return `${(credits / 1000).toFixed(1)}k`;
  const rounded = Math.round(credits * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * Display string for a credit cost estimate, used in UI before sending.
 */
export function creditCostLabel(credits: number): string {
  const label = formatCredits(credits);
  return `~${label} credit${credits === 1 ? "" : "s"}`;
}
