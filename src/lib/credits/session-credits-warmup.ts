/**
 * Session entry credits — start at 0ms, complete during intro (~2.4s).
 */
import type { Profile } from "@/lib/supabase/types";
import { monthlyActionCreditsForPlan } from "@/lib/action-credits/action-credit-allowances";
import { monthlyTokensForPlan, normalizePlanId } from "@/lib/billing/plans";
import {
  CANONICAL_CREDIT_SOURCE,
  type CanonicalCreditBucket,
  type CanonicalCreditsPayload,
} from "@/lib/credits/canonical-credits";
import {
  markLiteCreditsFetched,
  resetCreditsBootstrap,
  shouldSkipLiteCreditsFetch,
} from "@/lib/credits/credits-bootstrap";
import { seedCreditsFromProfile } from "@/lib/credits/seed-credits-from-profile";
import { markCreditsFirstPaint } from "@/lib/credits/credits-local-cache";
import { hydrateCreditsFromLocalCache, useCreditsStore } from "@/lib/stores/credits-store";

/** Lite fetch window — covers full intro duration. */
export const SESSION_CREDITS_LITE_TIMEOUT_MS = 2_800;

let warmupUserId: string | null = null;

function stashUserId(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem("vodex:last-user-id", userId);
  } catch {
    /* ignore */
  }
}

function planFallbackPayload(planId = "free"): CanonicalCreditsPayload {
  const plan = normalizePlanId(planId);
  const buildCap = monthlyTokensForPlan(plan);
  const actionCap = monthlyActionCreditsForPlan(plan);
  const bucket = (available: number, allowance: number): CanonicalCreditBucket => ({
    available,
    planAllowance: allowance,
    usedThisPeriod: Math.max(0, allowance - available),
    bonusActive: 0,
    bonusLabel: null,
    bonusExpiresAt: null,
    resetDate: null,
    reserved: 0,
    source: CANONICAL_CREDIT_SOURCE,
  });
  return {
    planId: plan,
    build: bucket(buildCap, buildCap),
    action: bucket(0, actionCap),
  };
}

export function syncCreditsLiteForSession(userId: string): Promise<CanonicalCreditsPayload | null> {
  if (shouldSkipLiteCreditsFetch(userId) && useCreditsStore.getState().isConfirmed) {
    const s = useCreditsStore.getState();
    return Promise.resolve({
      build: s.build,
      action: s.action,
      planId: normalizePlanId(s.planId) as CanonicalCreditsPayload["planId"],
    });
  }

  return useCreditsStore.getState().syncFromDB({
    reason: "bootstrap",
    force: true,
    liteTimeoutMs: SESSION_CREDITS_LITE_TIMEOUT_MS,
  });
}

/**
 * Call as soon as user id is known — idempotent per user per page load.
 */
export function beginSessionCreditsWarmup(
  userId: string,
  profile?: Partial<Profile> | null,
): void {
  if (!userId || typeof window === "undefined") return;

  stashUserId(userId);

  const before = useCreditsStore.getState();
  if (!before.isConfirmed) {
    hydrateCreditsFromLocalCache(userId);
  }

  const afterCache = useCreditsStore.getState();
  if (!afterCache.isConfirmed) {
    if (profile?.id) {
      seedCreditsFromProfile(profile as Profile);
      markCreditsFirstPaint(userId);
    } else if (afterCache.build.available <= 0 && afterCache.action.available <= 0) {
      useCreditsStore.getState().applyInstantCredits(planFallbackPayload(profile?.plan_id ?? "free"));
      markCreditsFirstPaint(userId);
    }
  }

  if (warmupUserId === userId) {
    void syncCreditsLiteForSession(userId).then((payload) => {
      if (payload) markLiteCreditsFetched(userId);
    });
    return;
  }
  warmupUserId = userId;

  void syncCreditsLiteForSession(userId).then((payload) => {
    if (payload) markLiteCreditsFetched(userId);
  });
}

export function resetSessionCreditsWarmup(): void {
  warmupUserId = null;
  resetCreditsBootstrap();
}

/** @deprecated use beginSessionCreditsWarmup */
export function runCreditsBootstrap(userId: string, profile?: Partial<Profile> | null): void {
  beginSessionCreditsWarmup(userId, profile);
}
