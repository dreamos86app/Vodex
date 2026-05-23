import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { ensureUserProfileServer } from "@/lib/auth/ensure-user-profile-server";
import { buildChargeTokensRpcPayload } from "@/lib/db/charge-tokens-rpc";
import { assertProfitableCharge } from "@/lib/billing/credit-profit-guard";
import { logSecurityAudit } from "@/lib/security/audit-events";
import { writeCreditEvent } from "@/lib/credits/credit-events";

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
  provider?: string | null;
  routeReason?: string | null;
};

export type ChargeAiOperationResult = {
  charged: boolean;
  remaining: number | null;
  error?: string | null;
  idempotent?: boolean;
};

function logCredits(level: "info" | "warn", msg: string, extra?: Record<string, unknown>) {
  const line = `[credits] ${msg}`;
  if (level === "warn") console.warn(line, extra ?? "");
  else console.info(line, extra ?? "");
}

async function fetchProfileBalance(writer: Writer, userId: string): Promise<number | null> {
  const { data } = await writer
    .from("profiles")
    .select("credits_remaining")
    .eq("id", userId)
    .maybeSingle();
  return typeof data?.credits_remaining === "number" ? data.credits_remaining : null;
}

/**
 * Server-authoritative credit charge after successful AI work.
 * Uses charge_tokens RPC (idempotent via operation_id / idempotency_key).
 */
export async function chargeAiOperation(
  writer: Writer,
  input: ChargeAiOperationInput,
): Promise<ChargeAiOperationResult> {
  if (input.amount < 1) {
    logCredits("info", "charge skipped reason", { reason: "invalid_amount" });
    return { charged: false, remaining: null, error: "invalid_amount" };
  }

  const profitProviderUsd =
    input.mode === "discuss"
      ? Math.min(input.providerCostUsd ?? 0, 0.03)
      : (input.providerCostUsd ?? 0);
  const profitCheck = assertProfitableCharge(input.amount, profitProviderUsd);
  if (!profitCheck.ok) {
    logCredits("warn", "charge blocked — below 3x margin", {
      reason: profitCheck.reason,
      operation_id: input.operationId,
    });
    await writer.from("ai_usage_logs").insert({
      user_id: input.userId,
      user_email: input.userEmail,
      model_id: input.modelId,
      mode: input.mode,
      tokens_charged: 0,
      credits_charged: 0,
      status: "charge_failed",
      error_message: profitCheck.reason ?? "unprofitable_charge",
      conversation_id: input.conversationId ?? null,
      operation_id: input.operationId,
      project_id: input.projectId ?? null,
      charged_after_success: false,
    } as never);
    await writeCreditEvent(writer, {
      userId: input.userId,
      operationId: input.operationId,
      modelId: input.modelId,
      creditsConsumed: 0,
      providerCostUsd: input.providerCostUsd ?? 0,
      status: "failed",
      projectId: input.projectId,
      conversationId: input.conversationId,
      metadata: { mode: input.mode, reason: profitCheck.reason ?? "unprofitable_charge" },
    });
    return { charged: false, remaining: null, error: profitCheck.reason ?? "unprofitable_charge" };
  }

  const ensured = await ensureUserProfileServer(input.userId, input.userEmail);
  if (!ensured.ok) {
    logCredits("warn", "charge failed", { reason: "ensure_profile", error: ensured.error });
  }

  logCredits("info", "charge start", {
    operation_id: input.operationId,
    mode: input.mode,
    model: input.modelId,
    amount: input.amount,
    user_id: input.userId,
  });

  const rpcPayload = buildChargeTokensRpcPayload({
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
        build_job_id: input.buildJobId,
      },
      p_project_id: input.projectId ?? null,
      p_conversation_id: input.conversationId ?? null,
    });

  const { data: creditResultRaw, error: rpcErr } = await writer.rpc(
    "charge_tokens",
    rpcPayload as never,
  );

  console.info("[credits] rpc result", {
    operation_id: input.operationId,
    error: rpcErr?.message ?? null,
    preview: creditResultRaw,
  });

  if (rpcErr) {
    logCredits("warn", "charge failed", { error: rpcErr.message, operation_id: input.operationId });
    await writer.from("ai_usage_logs").insert({
      user_id: input.userId,
      user_email: input.userEmail,
      model_id: input.modelId,
      mode: input.mode,
      provider: input.provider ?? null,
      route_reason: input.routeReason ?? null,
      tokens_charged: 0,
      credits_charged: 0,
      status: "charge_failed",
      error_message: rpcErr.message,
      conversation_id: input.conversationId ?? null,
      operation_id: input.operationId,
      project_id: input.projectId ?? null,
      charged_after_success: false,
    } as never);
    await writeCreditEvent(writer, {
      userId: input.userId,
      operationId: input.operationId,
      modelId: input.modelId,
      creditsConsumed: 0,
      providerCostUsd: input.providerCostUsd ?? 0,
      status: "failed",
      projectId: input.projectId,
      conversationId: input.conversationId,
      metadata: { mode: input.mode, reason: rpcErr.message },
    });
    return { charged: false, remaining: null, error: rpcErr.message };
  }

  const creditResult = creditResultRaw as {
    ok?: boolean;
    success?: boolean;
    charged?: boolean;
    remaining?: number;
    balance_after?: number;
    error?: string;
    idempotent?: boolean;
  } | null;

  const rpcOk = Boolean(creditResult?.ok ?? creditResult?.success ?? creditResult?.charged);
  const idempotent = Boolean(creditResult?.idempotent);
  let remaining =
    typeof creditResult?.balance_after === "number"
      ? creditResult.balance_after
      : typeof creditResult?.remaining === "number"
        ? creditResult.remaining
        : null;

  if (remaining == null && (rpcOk || idempotent)) {
    remaining = await fetchProfileBalance(writer, input.userId);
  }

  const charged = rpcOk && !idempotent;

  if (charged) {
    const usageRow: Record<string, unknown> = {
      user_id: input.userId,
      user_email: input.userEmail,
      model_id: input.modelId,
      mode: input.mode,
      provider: input.provider ?? null,
      route_reason: input.routeReason ?? null,
      tokens_charged: input.amount,
      credits_charged: input.amount,
      status: "success",
      conversation_id: input.conversationId ?? null,
      operation_id: input.operationId,
      project_id: input.projectId ?? null,
      charged_after_success: true,
      estimated_provider_cost: input.providerCostUsd ?? 0,
    };

    if (input.tokensInput != null) usageRow.tokens_input = input.tokensInput;
    if (input.tokensOutput != null) usageRow.tokens_output = input.tokensOutput;

    let { error: logErr } = await writer.from("ai_usage_logs").insert(usageRow as never);
    if (logErr?.message?.includes("does not exist") || logErr?.message?.includes("column")) {
      const slim = { ...usageRow };
      delete slim.tokens_input;
      delete slim.tokens_output;
      delete slim.provider;
      delete slim.route_reason;
      delete slim.charged_after_success;
      delete slim.estimated_provider_cost;
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

    // charge_tokens RPC writes the authoritative credit_events row on success.
    logCredits("info", "charge ok", {
      balance_after: remaining,
      operation_id: input.operationId,
    });

    await logSecurityAudit({
      userId: input.userId,
      action: "credit_charge",
      projectId: input.projectId ?? null,
      metadata: {
        amount: input.amount,
        mode: input.mode,
        modelId: input.modelId,
        operationId: input.operationId,
      },
    });
  } else if (idempotent) {
    logCredits("info", "charge skipped idempotent", {
      balance_after: remaining,
      operation_id: input.operationId,
    });
  } else {
    logCredits("warn", "charge failed", {
      error: creditResult?.error ?? "not_charged",
      operation_id: input.operationId,
    });
    await writeCreditEvent(writer, {
      userId: input.userId,
      operationId: input.operationId,
      modelId: input.modelId,
      creditsConsumed: 0,
      providerCostUsd: input.providerCostUsd ?? 0,
      status: "failed",
      projectId: input.projectId,
      conversationId: input.conversationId,
      metadata: {
        mode: input.mode,
        reason: creditResult?.error ?? "not_charged",
      },
    });
  }

  return {
    charged,
    remaining,
    error: charged || idempotent ? null : (creditResult?.error ?? "charge_failed"),
    idempotent,
  };
}
