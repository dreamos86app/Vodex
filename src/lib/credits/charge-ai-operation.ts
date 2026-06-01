import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { ensureUserProfileServer } from "@/lib/auth/ensure-user-profile-server";
import { buildChargeTokensRpcPayload } from "@/lib/db/charge-tokens-rpc";
import { assertProfitableCharge } from "@/lib/billing/credit-profit-guard";
import { MIN_CHARGEABLE_CREDITS } from "@/lib/billing/credit-pricing";
import { logCreditEconomicsAdmin } from "@/lib/billing/credit-admin-log";
import type { BuildCreditOperationType } from "@/lib/billing/build-credit-floors";
import {
  providerUsdToInternalCredits,
  TARGET_REVENUE_MULTIPLIER,
} from "@/lib/billing/pricing-config";
import { logSecurityAudit } from "@/lib/security/audit-events";
import { writeCreditEvent } from "@/lib/credits/credit-events";
import { canAffordAtomicAction } from "@/lib/billing/partial-build-credits";
import {
  resolveCreditBillingTarget,
  type CreditBillingTarget,
} from "@/lib/billing/workspace-credit-billing";

type Writer = SupabaseClient<Database>;

export type ChargeAiOperationInput = {
  /** User who triggered the action (session user). */
  actorUserId?: string;
  /** Billed account — resolved server-side from workspace billing_mode when omitted. */
  userId: string;
  userEmail: string;
  amount: number;
  workspaceId?: string | null;
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
  operationType?: BuildCreditOperationType;
  userCreditsReserved?: number | null;
  minimumFloorApplied?: boolean;
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
function usageLogRow(
  input: ChargeAiOperationInput,
  billing: CreditBillingTarget | null,
  chargeUserId: string,
  extra: Record<string, unknown>,
): Record<string, unknown> {
  return {
    user_id: chargeUserId,
    user_email: input.userEmail,
    actor_user_id: billing?.actorUserId ?? input.actorUserId ?? input.userId,
    workspace_id: billing?.workspaceId ?? input.workspaceId ?? null,
    billed_to_type: billing?.billedToType ?? "personal",
    billed_to_user_id: chargeUserId,
    action_type: input.operationType ?? input.mode,
    ...extra,
  };
}

export async function chargeAiOperation(
  writer: Writer,
  input: ChargeAiOperationInput,
): Promise<ChargeAiOperationResult> {
  const actorUserId = input.actorUserId ?? input.userId;
  let chargeUserId = input.userId;
  let billingTarget: CreditBillingTarget | null = null;

  if (input.projectId || input.workspaceId) {
    billingTarget = await resolveCreditBillingTarget(writer, {
      actorUserId,
      projectId: input.projectId,
      workspaceId: input.workspaceId,
      requiredCredits: input.amount,
    });
    chargeUserId = billingTarget.billedUserId;
  }

  if (input.amount < MIN_CHARGEABLE_CREDITS) {
    logCredits("info", "charge skipped reason", { reason: "invalid_amount", amount: input.amount });
    return { charged: false, remaining: null, error: "invalid_amount" };
  }

  const atomicModes = new Set([
    "image",
    "email",
    "speech",
    "video",
    "upload",
    "action",
    "app_logo_generation",
  ]);
  if (atomicModes.has(input.mode) || input.operationType) {
    const balance = await fetchProfileBalance(writer, chargeUserId);
    if (balance !== null && !canAffordAtomicAction(balance, input.amount)) {
      return {
        charged: false,
        remaining: balance,
        error: "insufficient_action_credits",
      };
    }
  }

  const profitProviderUsd =
    input.mode === "discuss"
      ? Math.min(input.providerCostUsd ?? 0, 0.03)
      : (input.providerCostUsd ?? 0);
  const profitCheck =
    input.mode === "discuss"
      ? assertProfitableCharge(input.amount, profitProviderUsd, "discuss")
      : assertProfitableCharge(
          input.amount,
          profitProviderUsd,
          input.operationType ?? (input.mode === "build" ? "first_build_standard" : "normal_edit"),
        );
  if (!profitCheck.ok) {
    logCredits("warn", "charge blocked — below 3x margin", {
      reason: profitCheck.reason,
      operation_id: input.operationId,
    });
    await writer.from("ai_usage_logs").insert(
      usageLogRow(input, billingTarget, chargeUserId, {
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
      }) as never,
    );
    await writeCreditEvent(writer, {
      userId: chargeUserId,
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

  const ensured = await ensureUserProfileServer(chargeUserId, input.userEmail);
  if (!ensured.ok) {
    logCredits("warn", "charge failed", { reason: "ensure_profile", error: ensured.error });
  }

  logCredits("info", "charge start", {
    operation_id: input.operationId,
    mode: input.mode,
    model: input.modelId,
    amount: input.amount,
    actor_user_id: actorUserId,
    billed_user_id: chargeUserId,
  });

  const providerUsd = input.providerCostUsd ?? 0;
  logCreditEconomicsAdmin("charge", {
    provider_cost_usd: providerUsd,
    internal_cost_credits: providerUsdToInternalCredits(providerUsd),
    user_credits_reserved: input.userCreditsReserved ?? null,
    user_credits_charged: input.amount,
    operation_type: input.operationType ?? input.mode,
    model_used: input.modelId,
    markup_multiplier: TARGET_REVENUE_MULTIPLIER,
    minimum_floor_applied: input.minimumFloorApplied ?? false,
    operation_id: input.operationId,
    mode: input.mode,
  });

  const rpcPayload = buildChargeTokensRpcPayload({
      p_user_id: chargeUserId,
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
        actor_user_id: actorUserId,
        billed_to_type: billingTarget?.billedToType,
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
    await writer.from("ai_usage_logs").insert(
      usageLogRow(input, billingTarget, chargeUserId, {
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
      }) as never,
    );
    await writeCreditEvent(writer, {
      userId: chargeUserId,
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
    remaining = await fetchProfileBalance(writer, chargeUserId);
  }

  const charged = rpcOk && !idempotent;

  if (charged) {
    const usageRow: Record<string, unknown> = usageLogRow(input, billingTarget, chargeUserId, {
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
    });

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
        .eq("id", chargeUserId);
    }

    // charge_tokens RPC writes the authoritative credit_events row on success.
    logCredits("info", "charge ok", {
      balance_after: remaining,
      operation_id: input.operationId,
      actor_user_id: actorUserId,
      billed_user_id: chargeUserId,
    });

    await logSecurityAudit({
      userId: actorUserId,
      action: "credit_charge",
      projectId: input.projectId ?? null,
      metadata: {
        amount: input.amount,
        mode: input.mode,
        modelId: input.modelId,
        operationId: input.operationId,
        billed_user_id: chargeUserId,
        billed_to_type: billingTarget?.billedToType,
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
      userId: chargeUserId,
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
        actor_user_id: actorUserId,
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
