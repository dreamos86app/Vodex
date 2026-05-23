import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { googleGenerativeApiKey } from "@/lib/llm/env-keys";
import { checkOperationBudget } from "@/lib/ai/cost-budget";
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
} from "@/lib/ai/provider-availability";
import { routeOperation, downRouteOperation, type RouteOperationContext } from "@/lib/ai/model-router";
import type { RoutedModelSpec } from "@/lib/ai/operation-types";
import { estimateTokenProviderCostUsd } from "@/lib/credits/token-cost";
import { assertProviderSpendAllowed } from "@/lib/credits/provider-spend-guard";
import { logServerOperation } from "@/lib/ops/server-ops-log";
import { pushRuntimeDiagnostic } from "@/lib/dev/runtime-diagnostics";
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
    return google(apiModelId);
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
  if (googleGenerativeApiKey()) return google("gemini-2.0-flash");
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
  const spendGuard = await assertProviderSpendAllowed(input.userEmail);
  if (!spendGuard.allowed) {
    pushRuntimeDiagnostic("provider_call_blocked", {
      operationType: input.operationType,
      code: spendGuard.code,
    });
    throw new Error(spendGuard.message);
  }

  let spec = routeOperation({
    operationType: input.operationType,
    complexity: input.complexity,
    ownerEmail: input.ownerEmail,
  });

  let budget = checkOperationBudget({
    operationType: input.operationType,
    modelId: spec.modelId,
    maxInputTokens: spec.maxInputTokens,
    maxOutputTokens: spec.maxOutputTokens,
    complexity: input.complexity,
    accumulatedCostUsd: input.accumulatedCostUsd,
  });

  if (!budget.allowed) {
    const down = downRouteOperation(spec, input.complexity);
    if (down) {
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
    if (!budget.allowed && budget.cappedOutputTokens >= 200) {
      budget = { ...budget, allowed: true };
    }
    if (!budget.allowed) {
      throw new Error(`Budget exceeded for ${input.operationType}: ${budget.reason}`);
    }
  }

  const maxTokens = budget.cappedOutputTokens;

  console.info("[provider_request_started]", {
    operation_id: input.operationId,
    operation_type: input.operationType,
    model: spec.modelId,
    api_model: spec.apiModelId,
    max_output_tokens: maxTokens,
    estimated_cost_usd: budget.estimatedCostUsd,
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
    const result = await generateText({
      model,
      system: input.system,
      prompt: input.prompt,
      maxOutputTokens: maxTokens,
      temperature: attemptSpec.temperature,
    });

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
      const classified = classifyProviderError(err);
      recordProviderFailure(classified.provider, classified.errorClass);
      lastErr = err instanceof Error ? err : new Error(String(err));
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
