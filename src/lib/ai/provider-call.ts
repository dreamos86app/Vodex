import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { resolveGoogleLanguageModel } from "@/lib/llm/google-provider";
import { openai } from "@ai-sdk/openai";
import { googleGenerativeApiKey } from "@/lib/llm/env-keys";
import { checkOperationBudget } from "@/lib/ai/cost-budget";
import { minOutputTokensForOperation } from "@/lib/ai/output-token-floors";
import {
  classifyProviderError,
  pickFailoverCatalogModel,
  providerFromModelId,
  userFacingProviderMessage,
} from "@/lib/ai/provider-errors";
import {
  isProviderSelectable,
  recordProviderFailure,
  recordProviderSuccess,
  recoverConfiguredProvidersFromAuthError,
} from "@/lib/ai/provider-availability";
import { routeOperation, downRouteOperation, type RouteOperationContext } from "@/lib/ai/model-router";
import { routeMainModelSpec } from "@/lib/ai/model-mix-router";
import { isAutomaticModelId } from "@/lib/ai/resolve-automatic-model";
import { logInternalModelDecision } from "@/lib/ai/model-decision-log";
import { resolveModelRuntime } from "@/lib/ai/model-catalog";
import { estimateCostBucket } from "@/lib/ai/model-orchestration-policy";
import type { RoutedModelSpec } from "@/lib/ai/operation-types";
import { estimateTokenProviderCostUsd } from "@/lib/credits/token-cost";
import { withGoogleProviderOptions } from "@/lib/ai/gemini-generate-options";
import { assertProviderSpendAllowed } from "@/lib/credits/provider-spend-guard";
import { logServerOperation } from "@/lib/ops/server-ops-log";
import { logProviderAiUsage } from "@/lib/ai/log-provider-ai-usage";
import { pushRuntimeDiagnostic } from "@/lib/dev/runtime-diagnostics";
import {
  isProviderTimeoutError,
  timeoutForOperationType,
} from "@/lib/ai/provider-timeouts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type ProviderCallInput = {
  writer?: SupabaseClient<Database>;
  userId: string;
  userEmail?: string | null;
  operationId: string;
  operationType: RouteOperationContext["operationType"];
  system: string;
  prompt: string;
  complexity?: number;
  ownerEmail?: string | null;
  projectId?: string | null;
  conversationId?: string | null;
  accumulatedCostUsd?: number;
  userSelectedModelId?: string | null;
  /** Hard cap; defaults from operation type when omitted. */
  timeoutMs?: number;
};

export type ProviderCallResult = {
  text: string;
  spec: RoutedModelSpec;
  inputTokens: number | null;
  outputTokens: number | null;
  providerCostUsd: number;
  truncated: boolean;
  formatViolation: boolean;
};

function resolveLanguageModel(apiModelId: string) {
  if (apiModelId.startsWith("gemini")) {
    if (!googleGenerativeApiKey()) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY not configured");
    return resolveGoogleLanguageModel(apiModelId);
  }
  if (apiModelId.startsWith("claude")) {
    if (!process.env.ANTHROPIC_API_KEY?.trim()) throw new Error("ANTHROPIC_API_KEY not configured");
    return anthropic(apiModelId);
  }
  if (apiModelId.startsWith("gpt")) {
    if (!process.env.OPENAI_API_KEY?.trim()) throw new Error("OPENAI_API_KEY not configured");
    return openai(apiModelId);
  }
  if (process.env.OPENAI_API_KEY?.trim()) return openai("gpt-4o-mini");
  if (googleGenerativeApiKey()) return resolveGoogleLanguageModel("gemini-2.0-flash");
  if (process.env.ANTHROPIC_API_KEY?.trim()) return anthropic("claude-haiku-4-5");
  throw new Error("No LLM API key configured");
}

function stripMarkdownFences(text: string): string {
  return text.replace(/```[\s\S]*?```/g, "").trim();
}

/**
 * All non-streaming model calls go through here — enforces caps and logging.
 */
export async function callProviderStructured(input: ProviderCallInput): Promise<ProviderCallResult> {
  recoverConfiguredProvidersFromAuthError();
  const spendGuard = await assertProviderSpendAllowed(input.userEmail);
  if (!spendGuard.allowed) {
    pushRuntimeDiagnostic("provider_call_blocked", {
      operationType: input.operationType,
      code: spendGuard.code,
    });
    throw new Error(spendGuard.message);
  }

  const { mix, spec: routedSpec } = routeMainModelSpec({
    operationType: input.operationType,
    userSelectedModelId: input.userSelectedModelId,
    complexity: input.complexity,
    ownerEmail: input.ownerEmail,
  });
  let spec = routedSpec;

  const userSelectedLocked =
    Boolean(input.userSelectedModelId) && !isAutomaticModelId(input.userSelectedModelId);

  let budget = checkOperationBudget({
    operationType: input.operationType,
    modelId: spec.modelId,
    maxInputTokens: spec.maxInputTokens,
    maxOutputTokens: spec.maxOutputTokens,
    complexity: input.complexity,
    accumulatedCostUsd: input.accumulatedCostUsd,
  });

  if (!budget.allowed && !userSelectedLocked) {
    const isImplementation =
      input.operationType === "frontend_implementation" ||
      input.operationType === "backend_implementation" ||
      input.operationType === "code_repair_hard";
    const down = isImplementation ? null : downRouteOperation(spec, input.complexity);
    if (down && down.modelId !== spec.modelId) {
      spec = down;
      budget = checkOperationBudget({
        operationType: input.operationType,
        modelId: spec.modelId,
        maxInputTokens: spec.maxInputTokens,
        maxOutputTokens: spec.maxOutputTokens,
        complexity: input.complexity,
        accumulatedCostUsd: input.accumulatedCostUsd,
      });
    }
  }
  const qualityFloor = minOutputTokensForOperation(
    input.operationType,
    input.complexity ?? 5,
  );
  if (!budget.allowed && (userSelectedLocked || budget.cappedOutputTokens >= qualityFloor)) {
    budget = { ...budget, allowed: true };
  }
  if (!budget.allowed) {
    throw new Error(`Budget exceeded for ${input.operationType}: ${budget.reason}`);
  }

  const maxTokens = Math.max(budget.cappedOutputTokens, qualityFloor);
  const callStarted = performance.now();
  const timeoutMs = input.timeoutMs ?? timeoutForOperationType(input.operationType);
  const abortController = timeoutMs ? new AbortController() : null;
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  if (abortController && timeoutMs) {
    timeoutHandle = setTimeout(() => abortController.abort(), timeoutMs);
  }

  console.info("[provider_request_started]", {
    operation_id: input.operationId,
    operation_type: input.operationType,
    selected_model_id: input.userSelectedModelId ?? "automatic",
    primary_implementation_model: spec.modelId,
    helper_model: mix.helperModelId,
    resolved_because: spec.routeReason,
    model_mix_policy: mix.policyNote,
    api_model: spec.apiModelId,
    max_output_tokens: maxTokens,
    estimated_cost_usd: budget.estimatedCostUsd,
    timeout_ms: timeoutMs ?? null,
    abort_controller: Boolean(abortController),
  });

  if (input.writer) {
    await logServerOperation({
      writer: input.writer,
      userId: input.userId,
      userEmail: input.userEmail,
      stage: "chat",
      event: "provider_request_started",
      status: "ok",
      modelId: spec.modelId,
      mode: input.operationType,
      provider: spec.provider,
      operationId: input.operationId,
      projectId: input.projectId,
      conversationId: input.conversationId,
      metadata: { max_tokens: maxTokens, estimated_cost: budget.estimatedCostUsd },
    });
  }

  const providersToTry: Array<{ spec: typeof spec; failover: boolean }> = [{ spec, failover: false }];
  const primaryProvider = providerFromModelId(spec.modelId);
  if (!isProviderSelectable(primaryProvider)) {
    const altId = pickFailoverCatalogModel(primaryProvider, input.operationType);
    if (altId) {
      const altSpec = routeOperation({
        operationType: input.operationType,
        requestedModelId: altId,
        complexity: input.complexity,
        ownerEmail: input.ownerEmail,
      });
      providersToTry.push({ spec: altSpec, failover: true });
    }
  }

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < providersToTry.length; attempt++) {
    const attemptSpec = providersToTry[attempt]!.spec;
    const isFailover = providersToTry[attempt]!.failover;
    try {
    const model = resolveLanguageModel(attemptSpec.apiModelId);
    const result = await generateText(
      withGoogleProviderOptions(attemptSpec.apiModelId, {
        model,
        system: input.system,
        prompt: input.prompt,
        maxOutputTokens: maxTokens,
        temperature: attemptSpec.temperature,
        abortSignal: abortController?.signal,
      }),
    );

    if (timeoutHandle) clearTimeout(timeoutHandle);

    recordProviderSuccess(providerFromModelId(attemptSpec.modelId));

    const raw = result.text ?? "";
    const formatViolation =
      attemptSpec.strictJson && (!raw.trim().startsWith("{") || raw.includes("```"));
    const text = attemptSpec.strictJson ? raw.trim() : raw;
    const inTok = result.usage?.inputTokens ?? null;
    const outTok = result.usage?.outputTokens ?? null;
    const providerCostUsd = estimateTokenProviderCostUsd(
      attemptSpec.modelId,
      inTok ?? 1500,
      outTok ?? Math.min(maxTokens, 800),
    );

    console.info("[provider_request_finished]", {
      operation_id: input.operationId,
      input_tokens: inTok,
      output_tokens: outTok,
      provider_cost_usd: providerCostUsd,
      failover: isFailover,
      model: attemptSpec.modelId,
    });

    const runtime = resolveModelRuntime(mix.userSelectedModelId ?? attemptSpec.modelId);
    logInternalModelDecision({
      operation_id: input.operationId,
      user_id: input.userId,
      project_id: input.projectId ?? null,
      mode: mix.mode,
      user_selected_model: mix.userSelectedModelId,
      user_selected_model_label: runtime.userSelectedModelLabel,
      actual_model_id: runtime.actualModelId,
      helper_model_used: mix.helperModelId,
      main_model_used: attemptSpec.modelId,
      provider_used: mix.mainProvider,
      fallback_provider: mix.fallbackApplied ? providerFromModelId(attemptSpec.modelId) : null,
      fallback_reason: mix.fallbackReason ?? (isFailover ? "provider_failover" : null),
      estimated_cost_bucket: estimateCostBucket(input.operationType),
      actual_input_tokens: inTok,
      actual_output_tokens: outTok,
      actual_cost_usd: providerCostUsd,
      latency_ms: Math.round(performance.now() - callStarted),
      success: true,
    });

    await logProviderAiUsage(input.writer, {
      userId: input.userId,
      userEmail: input.userEmail,
      operationId: input.operationId,
      operationType: input.operationType,
      modelId: attemptSpec.modelId,
      projectId: input.projectId,
      conversationId: input.conversationId,
      inputTokens: inTok,
      outputTokens: outTok,
      providerCostUsd,
      status: "success",
      creditsCharged: 0,
    });

    return {
      text,
      spec: attemptSpec,
      inputTokens: inTok,
      outputTokens: outTok,
      providerCostUsd,
      truncated: (outTok ?? 0) >= maxTokens * 0.95,
      formatViolation,
    };
    } catch (err) {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      const classified = classifyProviderError(err);
      recordProviderFailure(classified.provider, classified.errorClass);
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (isProviderTimeoutError(err)) {
        console.warn("[provider_request_timeout]", {
          operation_id: input.operationId,
          operation_type: input.operationType,
          timeout_ms: timeoutMs,
          model: attemptSpec.modelId,
        });
        throw new Error(`provider_timeout:${input.operationType}`);
      }
      console.warn("[provider_request_failed]", {
        operation_id: input.operationId,
        error: classified.raw,
        error_class: classified.errorClass,
        failover: isFailover,
      });
      if (input.writer) {
        await logServerOperation({
          writer: input.writer,
          userId: input.userId,
          userEmail: input.userEmail,
          stage: "chat",
          event: "provider_request_failed",
          status: "error",
          errorMessage: classified.raw,
          modelId: attemptSpec.modelId,
          mode: input.operationType,
          operationId: input.operationId,
          projectId: input.projectId,
          metadata: { error_class: classified.errorClass, failover: isFailover },
        });
      }
      if (classified.failover && attempt === 0) {
        const altId = pickFailoverCatalogModel(classified.provider, input.operationType);
        if (altId && altId !== attemptSpec.modelId) {
          const altSpec = routeOperation({
            operationType: input.operationType,
            requestedModelId: altId,
            complexity: input.complexity,
            ownerEmail: input.ownerEmail,
          });
          providersToTry.push({ spec: altSpec, failover: true });
          continue;
        }
      }
      break;
    }
  }

  const classified = classifyProviderError(lastErr);
  const failSpec = providersToTry[providersToTry.length - 1]?.spec;
  await logProviderAiUsage(input.writer, {
    userId: input.userId,
    userEmail: input.userEmail,
    operationId: input.operationId,
    operationType: input.operationType,
    modelId: failSpec?.modelId ?? "unknown",
    projectId: input.projectId,
    conversationId: input.conversationId,
    providerCostUsd: 0,
    status: "error",
    errorMessage: classified.raw,
    creditsCharged: 0,
  });
  throw new Error(userFacingProviderMessage(classified.errorClass, providersToTry.length > 1));
}

export function parseJsonFromModel<T>(text: string): T | null {
  try {
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]!) as T;
    } catch {
      return null;
    }
  }
}
