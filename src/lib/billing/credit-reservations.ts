import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { buildChargeTokensRpcPayload } from "@/lib/db/charge-tokens-rpc";
import { quoteGenerationCost, type GenerationCostQuote } from "@/lib/billing/credit-profit-guard";
import type { QuoteGenerationCostInput } from "@/lib/billing/credit-profit-guard";
import { dreamosLog } from "@/lib/diagnostics/dreamos-logger";
import { logSecurityAudit } from "@/lib/security/audit-events";
import { logCreditEconomicsAdmin } from "@/lib/billing/credit-admin-log";
import { resolveCreditBillingTarget } from "@/lib/billing/workspace-credit-billing";

type Writer = SupabaseClient<Database>;

function reservationWriter(writer: Writer): Writer {
  return createServiceRoleClient() ?? writer;
}

export type ReserveCreditsInput = QuoteGenerationCostInput & {
  /** Session user who triggered generation. */
  actorUserId?: string;
  /** Legacy alias — treated as actor when actorUserId omitted. */
  userId: string;
  userEmail: string;
  generationId: string;
  projectId?: string | null;
  workspaceId?: string | null;
  conversationId?: string | null;
  balance: number;
  /** When set, reserves this amount instead of full quote (partial build credits). */
  overrideReserveAmount?: number;
};

export type ReserveCreditsResult =
  | {
      ok: true;
      quote: GenerationCostQuote;
      reserved: number;
      remaining: number | null;
      reservationId: string;
    }
  | { ok: false; error: string; code: string; quote?: GenerationCostQuote };

async function grantRefund(
  writer: Writer,
  userId: string,
  amount: number,
  operationId: string,
  metadata: Record<string, unknown>,
): Promise<boolean> {
  if (amount < 1) return true;
  const { error } = await writer.rpc("grant_tokens", {
    p_user_id: userId,
    p_amount: amount,
    p_reason: "generation_refund",
    p_idempotency_key: operationId,
    p_metadata: {
      ...metadata,
      model_id:
        typeof metadata.model_id === "string" && metadata.model_id.trim()
          ? metadata.model_id
          : "system_refund",
    },
  } as never);
  if (error) {
    dreamosLog({
      source: "server",
      category: "credit",
      severity: "error",
      message: "grant_tokens refund failed",
      userId,
      metadata: { error: error.message, operationId, amount },
    });
    return false;
  }
  await logSecurityAudit({
    userId,
    action: "credit_refund",
    metadata: { amount, operationId, ...metadata },
  });
  return true;
}

/**
 * Reserve user credits before generation (debit via charge_tokens).
 * Idempotent per generationId.
 */
export async function reserveCreditsForGeneration(
  writer: Writer,
  input: ReserveCreditsInput,
): Promise<ReserveCreditsResult> {
  const actorUserId = input.actorUserId ?? input.userId;
  let billedUserId = input.userId;
  let billedToType: "personal" | "workspace" = "personal";

  if (input.projectId || input.workspaceId) {
    const target = await resolveCreditBillingTarget(writer, {
      actorUserId,
      projectId: input.projectId,
      workspaceId: input.workspaceId,
      requiredCredits: input.overrideReserveAmount,
    });
    billedUserId = target.billedUserId;
    billedToType = target.billedToType;
  }

  const quote = quoteGenerationCost(input);
  const quotedReserve = quote.userCreditsReserved;
  const toReserve =
    typeof input.overrideReserveAmount === "number" && input.overrideReserveAmount > 0
      ? Math.min(Math.floor(input.balance), Math.ceil(input.overrideReserveAmount))
      : quotedReserve;

  logCreditEconomicsAdmin("reserve", {
    provider_cost_usd: quote.estimatedProviderCostUsd,
    internal_cost_credits: quote.internalCostCredits,
    user_credits_reserved: toReserve,
    user_credits_charged: null,
    operation_type: quote.operationType,
    model_used: input.selectedModel,
    markup_multiplier: quote.adminBreakdown.markup_multiplier,
    minimum_floor_applied: quote.adminBreakdown.minimum_floor_applied,
    operation_id: input.generationId,
    mode: input.mode,
    generation_id: input.generationId,
  });

  if (input.balance <= 0) {
    return {
      ok: false,
      error: "Your Build Credits are used up. Add credits or upgrade to keep building.",
      code: "blocked_zero_credits",
      quote,
    };
  }

  if (input.balance < toReserve) {
    return {
      ok: false,
      error: `Need ${toReserve} credits; you have ${input.balance}.`,
      code: "insufficient_tokens",
      quote,
    };
  }

  if (!quote.safeToRun) {
    return {
      ok: false,
      error: "This request cannot be priced safely. Try a cheaper mode or add credits.",
      code: "unprofitable_quote",
      quote,
    };
  }

  const reserveOpId = `reserve:${input.generationId}`;

  const rpcPayload = buildChargeTokensRpcPayload({
    p_user_id: billedUserId,
    p_amount: toReserve,
    p_reason: `Reserve ${input.mode}`,
    p_idempotency_key: reserveOpId,
    p_metadata: {
      type: "reservation",
      generation_id: input.generationId,
      mode: input.mode,
      model_id: input.selectedModel,
      quoted_user_credits: quote.userCreditsRequired,
      internal_cost_credits: quote.internalCostCredits,
      provider_cost_usd: quote.estimatedProviderCostUsd,
      operation_type: quote.operationType,
      minimum_floor_applied: quote.adminBreakdown.minimum_floor_applied,
      markup_multiplier: quote.adminBreakdown.markup_multiplier,
      project_id: input.projectId,
      conversation_id: input.conversationId,
      actor_user_id: actorUserId,
      billed_to_type: billedToType,
    },
    p_project_id: input.projectId ?? null,
    p_conversation_id: input.conversationId ?? null,
  });

  const { data: chargeRaw, error: rpcErr } = await writer.rpc("charge_tokens", rpcPayload as never);

  if (rpcErr) {
    return { ok: false, error: rpcErr.message, code: "reserve_failed", quote };
  }

  const charge = chargeRaw as {
    ok?: boolean;
    success?: boolean;
    charged?: boolean;
    balance_after?: number;
    remaining?: number;
    idempotent?: boolean;
  } | null;

  const rpcOk = Boolean(charge?.ok ?? charge?.success ?? charge?.charged ?? charge?.idempotent);
  if (!rpcOk) {
    return { ok: false, error: "Reservation charge failed", code: "reserve_failed", quote };
  }

  const remaining =
    typeof charge?.balance_after === "number"
      ? charge.balance_after
      : typeof charge?.remaining === "number"
        ? charge.remaining
        : null;

  const reservationRow = {
    user_id: billedUserId,
    generation_id: input.generationId,
    project_id: input.projectId ?? null,
    conversation_id: input.conversationId ?? null,
    mode: input.mode,
    quoted_user_credits: quote.userCreditsRequired,
    reserved_user_credits: toReserve,
    final_user_credits: null as number | null,
    internal_cost_credits: quote.internalCostCredits,
    provider_cost_usd: quote.estimatedProviderCostUsd,
    markup_multiplier: quote.revenueMultiplier,
    gross_margin_estimate: quote.estimatedGrossMargin,
    status: "reserved",
    metadata: {
      model_id: input.selectedModel,
      floor_reason: quote.floorReason,
      actor_user_id: actorUserId,
      billed_to_type: billedToType,
    },
  };

  const econWriter = reservationWriter(writer);
  const { data: inserted, error: insErr } = await econWriter
    .from("credit_reservations" as never)
    .insert(reservationRow as never)
    .select("id")
    .single();

  if (insErr && !insErr.message.includes("does not exist")) {
    dreamosLog({
      source: "server",
      category: "credit",
      severity: "warn",
      message: "credit_reservations insert failed (charge already applied)",
      userId: billedUserId,
      metadata: { error: insErr.message, actor_user_id: actorUserId },
    });
  }

  await econWriter.from("generation_cost_audits" as never).insert({
    user_id: billedUserId,
    generation_id: input.generationId,
    project_id: input.projectId ?? null,
    mode: input.mode,
    quoted_user_credits: quote.userCreditsRequired,
    reserved_user_credits: toReserve,
    internal_cost_credits: quote.internalCostCredits,
    provider_cost_usd: quote.estimatedProviderCostUsd,
    markup_multiplier: quote.revenueMultiplier,
    gross_margin_estimate: quote.estimatedGrossMargin,
    status: "reserved",
    metadata: quote.adminBreakdown,
  } as never).then(() => undefined, () => undefined);

  return {
    ok: true,
    quote,
    reserved: toReserve,
    remaining,
    reservationId: (inserted as { id?: string } | null)?.id ?? input.generationId,
  };
}

/**
 * After generation: refund unused reserved credits; platform absorbs overage.
 */
export async function reconcileGenerationReservation(
  writer: Writer,
  input: {
    userId: string;
    generationId: string;
    reservedCredits: number;
    actualUserCredits: number;
    providerCostUsd: number;
    success: boolean;
    projectId?: string | null;
  },
): Promise<{ refunded: number; finalCharged: number }> {
  const finalCharged = input.success ? Math.min(input.reservedCredits, input.actualUserCredits) : 0;
  const refundAmount = input.success
    ? Math.max(0, input.reservedCredits - finalCharged)
    : input.reservedCredits;

  if (refundAmount > 0) {
    await grantRefund(writer, input.userId, refundAmount, `refund:${input.generationId}`, {
      generation_id: input.generationId,
      reserved: input.reservedCredits,
      final: finalCharged,
      provider_cost_usd: input.providerCostUsd,
      success: input.success,
    });
  }

  const econWriter = reservationWriter(writer);
  await econWriter
    .from("credit_reservations" as never)
    .update({
      status: input.success ? "reconciled" : "refunded",
      final_user_credits: finalCharged,
      provider_cost_usd: input.providerCostUsd,
    } as never)
    .eq("generation_id" as never, input.generationId)
    .eq("user_id" as never, input.userId)
    .then(() => undefined, () => undefined);

  await econWriter.from("generation_cost_audits" as never).insert({
    user_id: input.userId,
    generation_id: input.generationId,
    project_id: input.projectId ?? null,
    mode: "build",
    quoted_user_credits: finalCharged,
    reserved_user_credits: input.reservedCredits,
    final_user_credits: finalCharged,
    internal_cost_credits: Math.ceil(input.providerCostUsd * 30),
    provider_cost_usd: input.providerCostUsd,
    status: input.success ? "reconciled" : "refunded",
    metadata: { refund: refundAmount },
  } as never).then(() => undefined, () => undefined);

  return { refunded: refundAmount, finalCharged };
}
