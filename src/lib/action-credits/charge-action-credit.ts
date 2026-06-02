import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { assertActionCreditsAffordable } from "@/lib/action-credits/assert-action-credits-affordable";
import {
  isExemptPlatformAction,
  quoteActionCredits,
} from "@/lib/action-credits/action-credit-pricing";
import { isFreeRuntimeAction } from "@/lib/action-credits/action-catalog";

export type ChargeActionCreditInput = {
  ownerUserId: string;
  projectId?: string | null;
  actionType: string;
  operationId: string;
  provider?: string;
  providerCostUsd?: number | null;
  dynamicFloor?: number | null;
  metadata?: Record<string, unknown>;
};

export type ChargeActionCreditResult =
  | { ok: true; charged: number; remaining: number; skipped?: boolean }
  | { ok: false; error: string; code: "insufficient" | "rpc_error" | "not_found" | "blocked" };

export async function getActionCreditBalance(
  ownerUserId: string,
  projectId?: string | null,
): Promise<number> {
  const { getActionCreditAvailability } = await import(
    "@/lib/action-credits/get-action-credit-availability"
  );
  const availability = await getActionCreditAvailability(ownerUserId, { projectId });
  return availability.totalAvailable;
}

export async function chargeActionCredit(
  input: ChargeActionCreditInput,
): Promise<ChargeActionCreditResult> {
  if (isExemptPlatformAction(input.metadata as { exempt?: boolean; source?: string })) {
    return {
      ok: true,
      charged: 0,
      remaining: await getActionCreditBalance(input.ownerUserId, input.projectId),
      skipped: true,
    };
  }

  const quote = quoteActionCredits({
    actionType: input.actionType,
    providerCostUsd: input.providerCostUsd,
    dynamicFloor: input.dynamicFloor,
  });

  if (quote.isFree || isFreeRuntimeAction(input.actionType)) {
    return {
      ok: true,
      charged: 0,
      remaining: await getActionCreditBalance(input.ownerUserId, input.projectId),
      skipped: true,
    };
  }

  const credits = quote.finalActionCredits;

  const affordable = await assertActionCreditsAffordable({
    ownerUserId: input.ownerUserId,
    projectId: input.projectId,
    actionType: input.actionType,
    providerCostUsd: input.providerCostUsd,
  });
  if (!affordable.ok) {
    return { ok: false, error: "Action Credits depleted.", code: "insufficient" };
  }

  const admin = createSupabaseAdmin();

  /** User-level pool (project_id null) — matches UI summary and plan sync. */
  const chargeProjectId = input.metadata?.charge_from_user_pool === false ? input.projectId ?? null : null;

  const { data, error } = await admin.rpc(
    "charge_action_credits" as "charge_tokens",
    {
      p_owner_user_id: input.ownerUserId,
      p_project_id: chargeProjectId,
      p_action_type: quote.canonicalType,
      p_credits: credits,
      p_operation_id: input.operationId,
      p_provider: input.provider ?? "runtime",
      p_provider_cost_usd: quote.providerCostUsd,
      p_metadata: {
        ...(input.metadata ?? {}),
        quoted_floor: quote.floor,
        quoted_protected_minimum: quote.protectedMinimum,
        multiplier_achieved: quote.multiplierAchieved,
      },
    } as never,
  );

  if (error) {
    const msg = error.message ?? "charge_action_credits failed";
    if (msg.includes("insufficient")) {
      return { ok: false, error: "Action Credits depleted.", code: "insufficient" };
    }
    return { ok: false, error: msg, code: "rpc_error" };
  }

  const row = data as { success?: boolean; error?: string; remaining?: number; charged?: number } | null;
  if (!row?.success) {
    if (row?.error?.includes("insufficient")) {
      return { ok: false, error: "Action Credits depleted.", code: "insufficient" };
    }
    return { ok: false, error: row?.error ?? "Action charge failed", code: "rpc_error" };
  }

  return {
    ok: true,
    charged: row.charged ?? credits,
    remaining: row.remaining ?? 0,
  };
}
