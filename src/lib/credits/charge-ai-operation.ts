import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Writer = SupabaseClient<Database>;

export type ChargeAiOperationInput = {
  userId: string;
  userEmail: string;
  amount: number;
  modelId: string;
  mode: string;
  operationId: string;
  conversationId?: string | null;
  projectId?: string | null;
  buildJobId?: string | null;
  providerCostUsd?: number;
  tokensInput?: number | null;
  tokensOutput?: number | null;
};

export type ChargeAiOperationResult = {
  charged: boolean;
  remaining: number | null;
  error?: string | null;
  idempotent?: boolean;
};

/**
 * Server-authoritative credit charge after successful AI work.
 * Uses charge_tokens RPC (idempotent via operationId).
 */
export async function chargeAiOperation(
  writer: Writer,
  input: ChargeAiOperationInput,
): Promise<ChargeAiOperationResult> {
  if (input.amount < 1) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[credits] skipped reason", "invalid_amount");
    }
    return { charged: false, remaining: null, error: "invalid_amount" };
  }

  const devLog = process.env.NODE_ENV !== "production";
  let balanceBefore: number | null = null;
  if (devLog) {
    const { data: prof } = await writer
      .from("profiles")
      .select("credits_remaining")
      .eq("id", input.userId)
      .maybeSingle();
    balanceBefore = prof?.credits_remaining ?? null;
    console.info("[credits] charge start", {
      operation_id: input.operationId,
      mode: input.mode,
      model: input.modelId,
      amount: input.amount,
      balance_before: balanceBefore,
    });
  }

  const { data: creditResultRaw, error: rpcErr } = await writer.rpc("charge_tokens", {
    p_user_id: input.userId,
    p_amount: input.amount,
    p_reason: `AI ${input.mode}`,
    p_idempotency_key: input.operationId,
    p_metadata: {
      model_id: input.modelId,
      mode: input.mode,
      conversation_id: input.conversationId,
      project_id: input.projectId,
      operation_id: input.operationId,
      provider_cost_usd: input.providerCostUsd,
    },
  } as never);

  if (rpcErr) {
    if (devLog) console.warn("[credits] charge failed", rpcErr.message);
    await writer.from("ai_usage_logs").insert({
      user_id: input.userId,
      user_email: input.userEmail,
      model_id: input.modelId,
      mode: input.mode,
      tokens_charged: 0,
      credits_charged: input.amount,
      status: "charge_failed",
      error_message: rpcErr.message,
      conversation_id: input.conversationId ?? null,
      operation_id: input.operationId,
      project_id: input.projectId ?? null,
      build_job_id: input.buildJobId ?? null,
    } as never);
    return { charged: false, remaining: null, error: rpcErr.message };
  }

  const creditResult = creditResultRaw as {
    success?: boolean;
    remaining?: number;
    error?: string;
    idempotent?: boolean;
  } | null;

  const charged = Boolean(creditResult?.success);
  const remaining =
    typeof creditResult?.remaining === "number" ? creditResult.remaining : null;

  if (charged) {
    await writer.from("credit_events").insert({
      user_id: input.userId,
      operation_id: input.operationId,
      model_id: input.modelId,
      credits_consumed: input.amount,
      event_type: "generation",
      conversation_id: input.conversationId ?? null,
      project_id: input.projectId ?? null,
      metadata: {
        mode: input.mode,
        build_job_id: input.buildJobId,
        provider_cost_usd: input.providerCostUsd,
      },
    } as never);

    const usageRow: Record<string, unknown> = {
      user_id: input.userId,
      user_email: input.userEmail,
      model_id: input.modelId,
      mode: input.mode,
      tokens_charged: input.amount,
      credits_charged: input.amount,
      credits_consumed: input.amount,
      status: "success",
      conversation_id: input.conversationId ?? null,
      operation_id: input.operationId,
      project_id: input.projectId ?? null,
      build_job_id: input.buildJobId ?? null,
    };

    if (input.tokensInput != null) usageRow.tokens_input = input.tokensInput;
    if (input.tokensOutput != null) usageRow.tokens_output = input.tokensOutput;

    let { error: logErr } = await writer.from("ai_usage_logs").insert(usageRow as never);
    if (logErr?.message?.includes("tokens_input") || logErr?.message?.includes("credits_consumed")) {
      const slim = { ...usageRow };
      delete slim.tokens_input;
      delete slim.tokens_output;
      delete slim.credits_consumed;
      logErr = (await writer.from("ai_usage_logs").insert(slim as never)).error;
    }

    if (typeof remaining === "number") {
      await writer
        .from("profiles")
        .update({
          credits_remaining: remaining,
          tokens_remaining: remaining,
        } as never)
        .eq("id", input.userId);
    }
  }

  if (devLog) {
    if (charged) {
      console.info("[credits] charge ok", {
        idempotent: creditResult?.idempotent,
        balance_after: remaining,
      });
    } else {
      console.info("[credits] charge failed", creditResult?.error ?? "not_charged");
    }
  }

  return {
    charged,
    remaining,
    error: charged ? null : (creditResult?.error ?? "charge_failed"),
    idempotent: creditResult?.idempotent,
  };
}
