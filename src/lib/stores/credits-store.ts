import { create } from "zustand";
import { monthlyTokensForPlan, normalizePlanId } from "@/lib/billing/plans";
import type { CanonicalCreditBucket, CanonicalCreditsPayload } from "@/lib/credits/canonical-credits";
import { dispatchCreditUpdated } from "@/lib/credits/credit-events-client";
import {
  loadCreditsLocalCache,
  markCreditsFirstPaint,
  saveCreditsLocalCache,
} from "@/lib/credits/credits-local-cache";
import {
  CREDITS_LITE_TTL_MS,
  markLiteCreditsFetched,
  shouldSkipLiteCreditsFetch,
} from "@/lib/credits/credits-bootstrap";

export type { CanonicalCreditBucket, CanonicalCreditsPayload };

/** Data older than this is refreshed on explicit triggers (popover open, etc.). */
export const CREDITS_STALE_MS = 90_000;

/** Minimum loading flash only on first load (no confirmed snapshot yet). */
export const CREDITS_MIN_LOADING_MS = 0;

/** Optional background refresh — only when tab is visible and data is very stale. */
export const CREDITS_BACKGROUND_STALE_MS = 120_000;

export type CreditSyncReason =
  | "bootstrap"
  | "popover-open"
  | "charge"
  | "admin-action"
  | "plan-change"
  | "profile-realtime"
  | "manual"
  | "invalidated";

export type CreditSyncOptions = {
  force?: boolean;
  reason?: CreditSyncReason;
  /** Override abort timeout for /api/credits?lite=1 (bootstrap uses intro duration). */
  liteTimeoutMs?: number;
};

const EMPTY_BUCKET: CanonicalCreditBucket = {
  available: 0,
  planAllowance: 0,
  usedThisPeriod: 0,
  bonusActive: 0,
  bonusLabel: null,
  bonusExpiresAt: null,
  resetDate: null,
  reserved: 0,
  source: "canonical_balance",
};

interface CreditsState {
  build: CanonicalCreditBucket;
  action: CanonicalCreditBucket;
  planId: string;
  loading: boolean;
  syncing: boolean;
  error: string | null;
  lastSyncedAt: number | null;
  isConfirmed: boolean;

  applyCanonical: (payload: CanonicalCreditsPayload) => void;
  /** Profile/bootstrap instant values — confirmed after /api/credits?lite=1. */
  applyProfileSeed: (payload: CanonicalCreditsPayload) => void;
  /** Instant balances for display — no “Syncing…” badge; lite fetch sets isConfirmed. */
  applyInstantCredits: (payload: CanonicalCreditsPayload) => void;
  /** @deprecated use applyProfileSeed */
  applyProfileHint: (payload: CanonicalCreditsPayload) => void;
  syncFromDB: (options?: CreditSyncOptions) => Promise<CanonicalCreditsPayload | null>;
  deductOptimistic: (amount: number) => void;
  reset: () => void;

  /** @deprecated use build.available */
  remaining: number;
  /** @deprecated use build.planAllowance */
  planAllowance: number;
  /** @deprecated use build.bonusActive */
  bonusCredits: number;
  /** @deprecated use action.available */
  actionCreditsRemaining: number;
  /** @deprecated use action.planAllowance */
  actionCreditsPlanAllowance: number;
  /** @deprecated use action.bonusActive */
  actionCreditsBonus: number;
  /** @deprecated use build.resetDate */
  resetAt: string | null;
  /** @deprecated use build.usedThisPeriod */
  totalUsedThisPeriod: number;
}

let inFlightRequest: Promise<CanonicalCreditsPayload | null> | null = null;

function roundCredit(value: number): number {
  return Math.round(value * 10) / 10;
}

function withLegacyFields(state: {
  build: CanonicalCreditBucket;
  action: CanonicalCreditBucket;
  planId: string;
  loading: boolean;
  syncing: boolean;
  error: string | null;
  lastSyncedAt: number | null;
  isConfirmed: boolean;
}) {
  return {
    ...state,
    remaining: state.build.available,
    planAllowance: state.build.planAllowance,
    bonusCredits: state.build.bonusActive,
    actionCreditsRemaining: state.action.available,
    actionCreditsPlanAllowance: state.action.planAllowance,
    actionCreditsBonus: state.action.bonusActive,
    resetAt: state.build.resetDate,
    totalUsedThisPeriod: state.build.usedThisPeriod,
  };
}

function logCreditSync(reason: CreditSyncReason | undefined, detail: string) {
  if (process.env.NODE_ENV !== "development") return;
  if (process.env.NEXT_PUBLIC_CREDITS_DEBUG !== "1") return;
  console.debug(`[credits] ${reason ?? "sync"}: ${detail}`);
}

export const useCreditsStore = create<CreditsState>()((set, get) => ({
  ...withLegacyFields({
    build: { ...EMPTY_BUCKET, planAllowance: 30 },
    action: { ...EMPTY_BUCKET, planAllowance: 20 },
    planId: "free",
    loading: false,
    syncing: false,
    error: null,
    lastSyncedAt: null,
    isConfirmed: false,
  }),

  applyCanonical: (payload) => {
    set(
      withLegacyFields({
        build: payload.build,
        action: payload.action,
        planId: payload.planId,
        loading: false,
        syncing: false,
        error: null,
        lastSyncedAt: Date.now(),
        isConfirmed: true,
      }),
    );
  },

  /** Instant display from profile/bootstrap — refined by /api/credits?lite=1. */
  applyProfileSeed: (payload) => {
    get().applyInstantCredits(payload);
    set({ syncing: true });
  },

  applyInstantCredits: (payload) => {
    set(
      withLegacyFields({
        build: payload.build,
        action: payload.action,
        planId: payload.planId,
        loading: false,
        syncing: false,
        error: null,
        lastSyncedAt: Date.now(),
        isConfirmed: false,
      }),
    );
  },

  /** Plan-only hint from profile — never overwrites confirmed credit balances. */
  applyProfileHint: (payload) => {
    if (get().isConfirmed) return;
    get().applyInstantCredits(payload);
  },

  deductOptimistic: (amount) =>
    set((s) =>
      withLegacyFields({
        build: {
          ...s.build,
          available: Math.max(0, roundCredit(s.build.available - amount)),
          usedThisPeriod: roundCredit(s.build.usedThisPeriod + amount),
        },
        action: s.action,
        planId: s.planId,
        loading: s.loading,
        syncing: s.syncing,
        error: s.error,
        lastSyncedAt: s.lastSyncedAt,
        isConfirmed: s.isConfirmed,
      }),
    ),

  syncFromDB: async (options) => {
    const force = options?.force ?? false;
    const reason = options?.reason;
    const liteTimeoutMs = options?.liteTimeoutMs ?? 1_000;
    const { lastSyncedAt, loading, isConfirmed } = get();
    const userId =
      typeof window !== "undefined" ? sessionStorage.getItem("vodex:last-user-id") : null;

    if (
      !force &&
      reason === "bootstrap" &&
      userId &&
      shouldSkipLiteCreditsFetch(userId)
    ) {
      const s = get();
      if (s.isConfirmed) {
        return {
          build: s.build,
          action: s.action,
          planId: normalizePlanId(s.planId) as CanonicalCreditsPayload["planId"],
        };
      }
    }

    if (!force && isConfirmed && lastSyncedAt && Date.now() - lastSyncedAt < CREDITS_STALE_MS) {
      logCreditSync(reason, "skipped — fresh cache");
      return {
        build: get().build,
        action: get().action,
        planId: normalizePlanId(get().planId) as CanonicalCreditsPayload["planId"],
      };
    }

    if (inFlightRequest) {
      logCreditSync(reason, "deduped — joined in-flight request");
      return inFlightRequest;
    }

    const hadDisplay =
      isConfirmed ||
      get().build.available > 0 ||
      get().action.available > 0 ||
      get().lastSyncedAt != null;
    if (!hadDisplay) {
      set({ loading: true, error: null, syncing: false });
    }

    const loadStartedAt = Date.now();

    inFlightRequest = (async () => {
      const controller = new AbortController();
      let abortTimer: ReturnType<typeof setTimeout> | undefined = setTimeout(
        () => controller.abort(),
        liteTimeoutMs,
      );
      try {
        const res = await fetch("/api/credits?lite=1", {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
          headers: { "X-Credit-Sync-Reason": reason ?? "sync" },
        });
        if (abortTimer) {
          clearTimeout(abortTimer);
          abortTimer = undefined;
        }
        if (!res.ok) throw new Error(`Failed to fetch credits (${res.status})`);

        const data = (await res.json()) as CanonicalCreditsPayload & {
          build?: CanonicalCreditBucket;
          action?: CanonicalCreditBucket;
          plan_id?: string;
        };

        if (!data.build || !data.action) {
          throw new Error("Invalid canonical credits response");
        }

        const payload: CanonicalCreditsPayload = {
          build: data.build,
          action: data.action,
          planId: normalizePlanId(data.plan_id ?? "free") as CanonicalCreditsPayload["planId"],
        };

        const prev = get();
        const unchanged =
          prev.isConfirmed &&
          prev.build.available === payload.build.available &&
          prev.action.available === payload.action.available &&
          prev.build.bonusActive === payload.build.bonusActive &&
          normalizePlanId(prev.planId) === payload.planId;
        if (!unchanged) {
          get().applyCanonical(payload);
        } else {
          set({ loading: false, syncing: false, lastSyncedAt: Date.now(), error: null, isConfirmed: true });
        }
        const uid = typeof window !== "undefined" ? sessionStorage.getItem("vodex:last-user-id") : null;
        if (uid) saveCreditsLocalCache(uid, payload);
        dispatchCreditUpdated(payload);
        if (userId) markLiteCreditsFetched(userId);
        if (process.env.NODE_ENV === "development") {
          console.info(`[credits] credits_lite_ms=${Math.round(Date.now() - loadStartedAt)}`);
        }
        logCreditSync(reason, "fetched ok");
        return payload;
      } catch (err) {
        const aborted = err instanceof Error && err.name === "AbortError";
        const msg = aborted
          ? "Credit sync slow — showing cached values"
          : err instanceof Error
            ? err.message
            : "Credit sync failed";
        const s = get();
        set({
          loading: false,
          syncing: false,
          isConfirmed: s.isConfirmed || (hadDisplay && aborted),
          error: hadDisplay || aborted ? null : msg,
        });
        logCreditSync(reason, `error — ${msg}`);
        return null;
      } finally {
        if (abortTimer) clearTimeout(abortTimer);
        inFlightRequest = null;
      }
    })();

    return inFlightRequest;
  },

  reset: () =>
    set(
      withLegacyFields({
        build: { ...EMPTY_BUCKET, planAllowance: 30 },
        action: { ...EMPTY_BUCKET, planAllowance: 20 },
        planId: "free",
        loading: false,
        syncing: false,
        error: null,
        lastSyncedAt: null,
        isConfirmed: false,
      }),
    ),
}));

/** Hydrate from localStorage before profile/API (instant paint). */
export function hydrateCreditsFromLocalCache(userId: string): void {
  const cached = loadCreditsLocalCache(userId);
  if (!cached) return;
  const state = useCreditsStore.getState();
  if (state.isConfirmed) return;
  useCreditsStore.getState().applyInstantCredits(cached);
  markCreditsFirstPaint(userId);
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem("vodex:last-user-id", userId);
    } catch {
      /* ignore */
    }
  }
}

/** Refresh credits after charge/admin/plan change — single forced fetch. */
export function refreshCredits(options?: CreditSyncOptions) {
  return useCreditsStore.getState().syncFromDB({
    force: true,
    reason: options?.reason ?? "manual",
    ...options,
  });
}

/** Resolve monthly build cap for display before canonical sync confirms. */
export function resolveBuildCreditCap(
  bucket: CanonicalCreditBucket | undefined,
  planId: string | undefined,
  isConfirmed: boolean,
): number {
  const planCap = monthlyTokensForPlan(normalizePlanId(planId ?? "free"));
  if (!isConfirmed || !bucket?.planAllowance) return planCap;
  return Math.max(bucket.planAllowance, planCap);
}

export const FREE_MONTHLY_QUOTA = 30;

/** @deprecated Prefer canonical plan allowance from store */
export function getMonthlyTokenQuotaForPlan(planId: string | undefined): number {
  return monthlyTokensForPlan(normalizePlanId(planId ?? "free"));
}
