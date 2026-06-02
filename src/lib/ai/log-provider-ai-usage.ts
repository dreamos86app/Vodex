import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Writer = SupabaseClient<Database>;

export const BUILD_RELATED_MODES = new Set([
  "build",
  "build_plan",
  "schema_design",
  "ui_design_plan",
  "frontend_implementation",
  "app_identity",
  "code_repair_small",
  "code_repair_hard",
  "publish",
  "build_credit_reconcile",
  "polish",
  "blueprint",
]);

export function isBuildRelatedUsageMode(mode: string, metadata?: Record<string, unknown> | null): boolean {
  const m = mode.toLowerCase();
  if (BUILD_RELATED_MODES.has(m)) return true;
  const op = typeof metadata?.operation_type === "string" ? metadata.operation_type : null;
  if (op && BUILD_RELATED_MODES.has(op)) return true;
  if (m.includes("build") || m.includes("repair") || m.includes("schema") || m.includes("publish")) {
    return true;
  }
  return false;
}

export function isUsageSuccessStatus(status: string): boolean {
  return status === "success" || status === "reconciled" || status === "logged";
}

/** Per provider call — observability row (credits may be 0; build charges are separate). */
export async function logProviderAiUsage(
  writer: Writer | undefined,
  input: {
    userId: string;
    userEmail?: string | null;
    operationId: string;
    operationType: string;
    modelId: string;
    projectId?: string | null;
    conversationId?: string | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
    providerCostUsd: number;
    status: "success" | "error" | "charge_failed";
    errorMessage?: string | null;
    creditsCharged?: number;
  },
): Promise<void> {
  if (!writer) return;

  const row: Record<string, unknown> = {
    user_id: input.userId,
    user_email: input.userEmail ?? null,
    model_id: input.modelId,
    mode: input.operationType,
    provider: null,
    route_reason: "provider_call",
    tokens_charged: input.creditsCharged ?? 0,
    credits_charged: input.creditsCharged ?? 0,
    tokens_input: input.inputTokens ?? null,
    tokens_output: input.outputTokens ?? null,
    status: input.status,
    error_message: input.errorMessage ?? null,
    conversation_id: input.conversationId ?? null,
    project_id: input.projectId ?? null,
    operation_id: input.operationId,
    metadata: {
      operation_type: input.operationType,
      provider_cost_usd: input.providerCostUsd,
      explain_zero_charge:
        (input.creditsCharged ?? 0) === 0
          ? "provider_observability_only_build_credits_billed_separately"
          : null,
    },
  };

  let { error } = await writer.from("ai_usage_logs").insert(row as never);
  if (error?.message?.includes("column") || error?.message?.includes("does not exist")) {
    const slim = {
      user_id: input.userId,
      user_email: input.userEmail,
      model_id: input.modelId,
      mode: input.operationType,
      tokens_charged: input.creditsCharged ?? 0,
      status: input.status,
      error_message: input.errorMessage,
      operation_id: input.operationId,
      project_id: input.projectId,
    };
    error = (await writer.from("ai_usage_logs").insert(slim as never)).error;
  }
  if (error && process.env.NODE_ENV !== "production") {
    console.warn("[ai-usage] provider log insert:", error.message);
  }
}
