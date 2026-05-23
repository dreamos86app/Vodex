import type { CreateIntent } from "@/lib/intent/create-intent-classifier";
import { planStageModels, type StageModelPlan } from "@/lib/ai/model-cost-optimizer";
import type { GenerationMode } from "@/lib/billing/pricing-config";
import { routeModel, type ModelRouteResult } from "@/lib/ai/model-router";
import {
  OperationBudgetTracker,
  type ModelEscalationReason,
  type OperationBudgetSummary,
} from "@/lib/ai/operation-budget-tracker";
import { logRouteDecision } from "@/lib/ai/route-decision-log";

export type ModelCostRuntimeInput = {
  stage: string;
  intent?: CreateIntent;
  mode: GenerationMode;
  complexity?: number;
  userCreditsBalance?: number;
  reservedCredits?: number;
  qualityLevel?: "quick" | "standard" | "production" | "premium";
  requestedModelId?: string;
  requiresBackendSecurity?: boolean;
  validationFailureCount?: number;
  intentAmbiguous?: boolean;
  budgetTracker?: OperationBudgetTracker;
};

export type ModelCostRuntimeResult = {
  plan: StageModelPlan | null;
  route: ModelRouteResult;
  recommendCheaperMode: boolean;
  recommendPremium: boolean;
  userNote: string;
  blockedBuild: boolean;
  escalationReason: ModelEscalationReason;
  budgetSummary?: OperationBudgetSummary;
  silentDowngrade: false;
};

/** Resolve model + token caps for a pipeline stage (chat, blueprint, polish, repair). */
export function resolveStageModel(input: ModelCostRuntimeInput): ModelCostRuntimeResult {
  const { stages, recommendCheaperMode, recommendPremium, userNote, silentDowngrade } =
    planStageModels({
      intent: input.intent,
      mode: input.mode,
      complexity: input.complexity,
      userCreditsBalance: input.userCreditsBalance,
      reservedCredits: input.reservedCredits,
      qualityLevel: input.qualityLevel,
      requiresBackendSecurity: input.requiresBackendSecurity,
      validationFailureCount: input.validationFailureCount,
      intentAmbiguous: input.intentAmbiguous,
    });

  const blockedBuild =
    input.intent === "question_only" ||
    input.intent === "pricing_question" ||
    input.intent === "unsafe_or_invalid";

  const plan = stages.find((s) => s.stage === input.stage) ?? stages[stages.length - 1] ?? null;
  const escalationReason = plan?.escalationReason ?? "none";

  const modelForRoute =
    input.requestedModelId && input.requestedModelId !== "automatic"
      ? input.requestedModelId
      : plan?.modelId ?? "gpt-4o-mini";

  const route = routeModel(
    input.mode === "build" ? "build" : input.mode === "edit" ? "edit" : "discuss",
    modelForRoute,
  );

  let budgetSummary: OperationBudgetSummary | undefined;
  if (input.budgetTracker && plan) {
    const caps = maxTokensForStage(plan);
    input.budgetTracker.record({
      operation: input.stage,
      stage: input.stage,
      modelId: modelForRoute,
      inputTokens: caps.maxInputTokens,
      outputTokens: caps.maxOutputTokens,
      cacheHit: plan.useCache,
      escalationReason,
    });
    budgetSummary = input.budgetTracker.summary();
  }

  logRouteDecision({
    stage: input.stage,
    selectedModel: modelForRoute,
    reason: route.routeReason || userNote,
    maxTokens: plan?.maxOutputTokens,
    estimatedCostUsd: budgetSummary?.accumulatedProviderUsd,
    actualCostUsd: budgetSummary?.accumulatedProviderUsd,
    fallback: route.isFallback,
    cacheHit: plan?.useCache,
    escalationReason: escalationReason !== "none" ? escalationReason : undefined,
  });

  return {
    plan,
    route,
    recommendCheaperMode,
    recommendPremium,
    userNote,
    blockedBuild,
    escalationReason,
    budgetSummary,
    silentDowngrade,
  };
}

export function maxTokensForStage(plan: StageModelPlan | null): {
  maxInputTokens: number;
  maxOutputTokens: number;
} {
  return {
    maxInputTokens: plan?.maxInputTokens ?? 8000,
    maxOutputTokens: plan?.maxOutputTokens ?? 900,
  };
}
