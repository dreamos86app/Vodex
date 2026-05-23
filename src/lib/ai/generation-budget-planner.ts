import {
  GLOBAL_MAX_OUTPUT_TOKENS,
  GLOBAL_MAX_VISIBLE_OUTPUT_TOKENS,
  FULL_BUILD_CAP_USD,
} from "@/lib/ai/cost-budget";
import { classifyBuildIntent } from "@/lib/ai/build-intent-classifier";
import { pickStandardFast } from "@/lib/ai/model-catalog";
import { quoteDiscussCost, quoteGenerationCost } from "@/lib/billing/credit-profit-guard";
import type { GenerationMode } from "@/lib/billing/pricing-config";

export type QualityLevel = "economy" | "balanced" | "premium";

export type GenerationBudgetInput = {
  prompt: string;
  mode: GenerationMode;
  fileCount?: number;
  projectFileCount?: number;
  selectedModel?: string;
  userPlan?: string | null;
  qualityLevel?: QualityLevel;
  hasExistingProject?: boolean;
};

export type GenerationBudgetPlan = {
  maxSteps: number;
  maxInputTokens: number;
  maxOutputTokensPerStep: number;
  maxTotalOutputTokens: number;
  providerBudgetUsd: number;
  cheapestSafeModel: string;
  escalationAllowed: boolean;
  cacheStrategy: "aggressive" | "standard" | "minimal";
  stopConditions: string[];
  complexity: number;
  creditQuote: ReturnType<typeof quoteGenerationCost>;
};

function estimateComplexity(prompt: string, fileCount: number): number {
  const intent = classifyBuildIntent(prompt);
  let c = 4;
  if (intent.intent === "build_app") c += 2;
  if (intent.intent === "edit_app") c += 1;
  if (prompt.length > 600) c += 1;
  if (prompt.length > 1200) c += 1;
  if (fileCount > 8) c += 2;
  if (/\b(auth|payment|stripe|admin|dashboard|realtime|supabase)\b/i.test(prompt)) c += 1;
  return Math.min(10, Math.max(1, c));
}

export function planGenerationBudget(input: GenerationBudgetInput): GenerationBudgetPlan {
  const files = (input.fileCount ?? 0) + (input.projectFileCount ?? 0);
  const selectedModel = input.selectedModel ?? pickStandardFast("openai");

  if (input.mode === "discuss") {
    const creditQuote = quoteDiscussCost({
      selectedModel,
      estimatedProviderCostUsd: 0.003,
    });
    return {
      maxSteps: 2,
      maxInputTokens: 4000,
      maxOutputTokensPerStep: GLOBAL_MAX_VISIBLE_OUTPUT_TOKENS,
      maxTotalOutputTokens: GLOBAL_MAX_VISIBLE_OUTPUT_TOKENS * 2,
      providerBudgetUsd: 0.012,
      cheapestSafeModel: selectedModel,
      escalationAllowed: false,
      cacheStrategy: "standard",
      stopConditions: ["provider_budget_exceeded", "max_total_output_reached", "user_cancelled"],
      complexity: 1,
      creditQuote,
    };
  }

  const complexity = estimateComplexity(input.prompt, files);
  const quality = input.qualityLevel ?? "balanced";

  const maxSteps =
    input.mode === "full_build" || input.mode === "build"
      ? quality === "economy"
        ? 8
        : 12
      : input.mode === "edit"
        ? 4
        : 2;

  const maxOutputPerStep = Math.min(
    GLOBAL_MAX_OUTPUT_TOKENS,
    quality === "premium" ? 4000 : 2600,
  );

  const maxTotalOutput =
    input.mode === "build" || input.mode === "full_build"
      ? quality === "economy"
        ? 8000
        : 12000
      : maxOutputPerStep * maxSteps;

  const providerBudgetUsd =
    input.mode === "build" || input.mode === "full_build"
      ? FULL_BUILD_CAP_USD
      : 0.012;

  const cheapestSafeModel =
    quality === "premium"
      ? pickStandardFast("anthropic")
      : pickStandardFast("openai");

  const resolvedModel = input.selectedModel ?? cheapestSafeModel;

  const creditQuote = quoteGenerationCost({
    mode: input.mode === "full_build" ? "full_build" : input.mode,
    complexity,
    selectedModel: resolvedModel,
    promptLength: input.prompt.length,
    expectedFiles: files || (input.mode === "build" ? 12 : 2),
    userPlan: input.userPlan,
    estimatedProviderCostUsd: providerBudgetUsd * 0.85,
  });

  return {
    maxSteps,
    maxInputTokens: input.hasExistingProject ? 6000 : 4000,
    maxOutputTokensPerStep: maxOutputPerStep,
    maxTotalOutputTokens: maxTotalOutput,
    providerBudgetUsd,
    cheapestSafeModel,
    escalationAllowed: quality !== "economy" && complexity >= 6,
    cacheStrategy: input.hasExistingProject ? "aggressive" : "standard",
    stopConditions: [
      "provider_budget_exceeded",
      "max_total_output_reached",
      "quality_gate_failed_twice",
      "user_cancelled",
    ],
    complexity,
    creditQuote,
  };
}
