import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizePlanId } from "@/lib/billing/plans";
import { monthlyActionCreditsForPlan } from "@/lib/action-credits/action-credit-allowances";
import {
  loadCanonicalCredits,
  loadCanonicalCreditsLite,
  serializeCanonicalCredits,
} from "@/lib/credits/canonical-credits";
import {
  applyE2eCreditBypassDisplay,
  shouldApplyE2eCreditBypass,
} from "@/lib/credits/e2e-credit-bypass-server";
import { getChargeTokensProbeCached } from "@/lib/db/charge-probe-cache";
import { maybeNotifyActionCreditWarning } from "@/lib/action-credits/action-credit-warnings";

export async function GET(req: Request) {
  const t0 = performance.now();
  const lite = new URL(req.url).searchParams.get("lite") === "1";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const tAuth = performance.now();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdmin();

  const [{ data: profile }, { data: actionRow }] = await Promise.all([
    admin
      .from("profiles")
      .select("plan_id, credits_remaining, credits_reset_at, email")
      .eq("id", user.id)
      .maybeSingle(),
    admin
      .from("action_credit_balances" as never)
      .select("balance")
      .eq("owner_user_id" as never, user.id)
      .is("project_id" as never, null)
      .maybeSingle(),
  ]);

  const tDb = performance.now();

  if (!profile || typeof profile.credits_remaining !== "number") {
    return NextResponse.json(
      {
        error: "Profile not available",
        hint: "Ensure public.profiles exists and SUPABASE_SERVICE_ROLE_KEY is set.",
      },
      { status: 503 },
    );
  }

  const planId = normalizePlanId(profile.plan_id ?? "free");
  const actionPlanAllowance = monthlyActionCreditsForPlan(planId);
  const actionBalance = (actionRow as { balance: number } | null)?.balance;
  const actionAvailable = typeof actionBalance === "number" ? actionBalance : actionPlanAllowance;

  let canonical = lite
    ? loadCanonicalCreditsLite({
        planId: profile.plan_id,
        creditsResetAt: profile.credits_reset_at,
        buildAvailable: profile.credits_remaining,
        actionAvailable,
      })
    : await loadCanonicalCredits({
        userId: user.id,
        planId: profile.plan_id,
        email: profile.email,
        creditsResetAt: profile.credits_reset_at,
        buildAvailable: profile.credits_remaining,
        actionAvailable,
        skipLedger: false,
      });

  if (shouldApplyE2eCreditBypass(user.id, profile.email)) {
    canonical = applyE2eCreditBypassDisplay(
      canonical,
      profile.credits_remaining,
      typeof actionBalance === "number" ? actionBalance : actionAvailable,
    );
  }

  const tCanonical = performance.now();

  const actionWarning = lite
    ? null
    : await maybeNotifyActionCreditWarning({
        userId: user.id,
        email: profile.email ?? user.email ?? null,
        planId,
        balance: typeof actionBalance === "number" ? actionBalance : actionAvailable,
      });

  const chargeProbe = lite ? { ok: true, lastError: null } : await getChargeTokensProbeCached();
  const tDone = performance.now();
  const timingMs = Math.round(tDone - t0);

  if (process.env.NODE_ENV === "development") {
    const label = lite ? "credits_lite_ms" : "credits_full_ms";
    console.info(`[credits] ${label}=${timingMs}`);
  }

  return NextResponse.json(
    {
      ...serializeCanonicalCredits(canonical),
      lite,
      actionCreditWarning: actionWarning,
      charging_enabled: chargeProbe.ok,
      charging_error: chargeProbe.ok ? null : chargeProbe.lastError,
      ...(process.env.NODE_ENV === "development"
        ? {
            _debug: {
              timings_ms: {
                auth: Math.round(tAuth - t0),
                db_parallel: Math.round(tDb - tAuth),
                canonical_compute: Math.round(tCanonical - tDb),
                charge_probe: Math.round(tDone - tCanonical),
                total: timingMs,
              },
            },
          }
        : {}),
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Credits-Timing-Ms": String(timingMs),
        ...(lite ? { "X-Credits-Lite": "1" } : {}),
      },
    },
  );
}
