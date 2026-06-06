import { createSupabaseAdmin } from "@/lib/supabase/admin";
import {
  actionCreditBonusFromBalance,
  monthlyActionCreditsForPlan,
} from "@/lib/action-credits/action-credit-allowances";
import { quoteActionCredits } from "@/lib/action-credits/action-credit-pricing";
import { isFreeRuntimeAction } from "@/lib/action-credits/action-catalog";
import { normalizePlanId } from "@/lib/billing/plans";
import { isE2eCreditTestAccount } from "@/lib/credits/e2e-credit-account";
import { readE2eCreditBypassMarker } from "@/lib/credits/e2e-credit-bypass-server";

export type ActionCreditAvailability = {
  available: boolean;
  remaining: number;
  planAllowance: number;
  bonus: number;
  totalAvailable: number;
  resetAt: string | null;
  reason: string | null;
  sourceTable: "action_credit_balances";
  sourceRow: "owner_user_id_null" | "owner_user_id_project_id";
  requiredForAction: number;
  actionType: string | null;
};

/**
 * Canonical server-side Action Credit availability (user pool + optional project row).
 * UI and icon generation must use this — not client-only state.
 */
export async function getActionCreditAvailability(
  ownerUserId: string,
  options?: {
    projectId?: string | null;
    actionType?: string | null;
    providerCostUsd?: number | null;
  },
): Promise<ActionCreditAvailability> {
  const admin = createSupabaseAdmin();
  const projectId = options?.projectId ?? null;
  const actionType = options?.actionType ?? null;

  const { data: profile } = await admin
    .from("profiles")
    .select("plan_id, credits_reset_at, email")
    .eq("id", ownerUserId)
    .maybeSingle();

  const plan = normalizePlanId((profile as { plan_id?: string } | null)?.plan_id ?? "free");
  const planAllowance = monthlyActionCreditsForPlan(plan);
  const resetAt = (profile as { credits_reset_at?: string } | null)?.credits_reset_at ?? null;

  const { data: userRows } = await admin
    .from("action_credit_balances" as never)
    .select("balance")
    .eq("owner_user_id" as never, ownerUserId)
    .is("project_id" as never, null);

  const userBalances = (userRows ?? [])
    .map((r) => Number((r as { balance?: number }).balance ?? 0))
    .filter((n) => Number.isFinite(n));
  const userBalance = userBalances.length ? Math.max(...userBalances) : null;
  let remaining = typeof userBalance === "number" ? userBalance : planAllowance;
  let sourceRow: ActionCreditAvailability["sourceRow"] = "owner_user_id_null";

  if (userBalances.length === 0 && remaining === 0) {
    remaining = planAllowance;
  }

  const email = (profile as { email?: string } | null)?.email ?? null;
  const e2eMarker = readE2eCreditBypassMarker();
  if (isE2eCreditTestAccount(email) || (e2eMarker?.userId && e2eMarker.userId === ownerUserId)) {
    const floor = Math.max(e2eMarker?.actionCredits ?? 500, 500);
    remaining = Math.max(remaining, floor);
  }

  if (projectId) {
    const { data: projRow } = await admin
      .from("action_credit_balances" as never)
      .select("balance")
      .eq("owner_user_id" as never, ownerUserId)
      .eq("project_id" as never, projectId)
      .maybeSingle();
    const projBal = (projRow as { balance?: number } | null)?.balance;
    if (typeof projBal === "number" && projBal > remaining) {
      remaining = projBal;
      sourceRow = "owner_user_id_project_id";
    }
  }

  const bonus = actionCreditBonusFromBalance({ balance: remaining, planAllowance });
  const totalAvailable = remaining;

  let requiredForAction = 0;
  if (actionType && !isFreeRuntimeAction(actionType)) {
    const quote = quoteActionCredits({
      actionType,
      providerCostUsd: options?.providerCostUsd ?? 0,
    });
    requiredForAction = quote.isFree ? 0 : quote.finalActionCredits;
  }

  const available = requiredForAction <= 0 || totalAvailable >= requiredForAction;
  const reason = available
    ? null
    : `insufficient: need ${requiredForAction}, have ${totalAvailable} (${sourceRow})`;

  return {
    available,
    remaining,
    planAllowance,
    bonus,
    totalAvailable,
    resetAt,
    reason,
    sourceTable: "action_credit_balances",
    sourceRow,
    requiredForAction,
    actionType,
  };
}
