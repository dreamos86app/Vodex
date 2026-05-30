import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { monthlyTokensForPlan, normalizePlanId } from "@/lib/billing/plans";
import { monthlyActionCreditsForPlan } from "@/lib/action-credits/action-credit-allowances";
import type { PlanId } from "@/lib/supabase/types";

/** Reset monthly Build + Action allowances after subscription activation or renewal. */
export async function syncPlanCreditsForUser(input: {
  userId: string;
  planId: string;
  periodEndIso: string;
  source: string;
  metadata?: Record<string, unknown>;
}): Promise<{ buildCredits: number; actionCredits: number }> {
  const admin = createSupabaseAdmin();
  const planId = normalizePlanId(input.planId) as PlanId;
  const buildCredits = monthlyTokensForPlan(planId);
  const actionCredits = monthlyActionCreditsForPlan(planId);

  await admin
    .from("profiles")
    .update({
      plan_id: planId,
      credits_remaining: buildCredits,
      credits_reset_at: input.periodEndIso,
      subscription_status: planId === "free" ? "free" : "active",
    } as never)
    .eq("id", input.userId);

  await admin.from("action_credit_balances" as never).upsert(
    {
      owner_user_id: input.userId,
      project_id: null,
      balance: actionCredits,
      updated_at: new Date().toISOString(),
    } as never,
    { onConflict: "owner_user_id,project_id" },
  );

  await admin.rpc("record_token_ledger", {
    p_user_id: input.userId,
    p_amount: -buildCredits,
    p_source: "purchase",
    p_reason: `${input.source} — ${planId}`,
    p_metadata: { ...(input.metadata ?? {}), plan_id: planId, action_credits: actionCredits },
  });

  return { buildCredits, actionCredits };
}
