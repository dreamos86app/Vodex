/**
 * DreamOS86 — Credits Store
 * Single source of truth for credit balance across the entire app.
 * Topbar, credits page, and AI actions all read from here.
 */
import { create } from "zustand";

interface CreditsState {
  remaining: number;
  planAllowance: number;
  resetAt: string | null;
  totalUsedThisPeriod: number;
  loading: boolean;
  lastSyncedAt: number | null;
  isConfirmed: boolean;

  setCredits: (remaining: number, resetAt?: string | null, planAllowance?: number) => void;
  setUsed: (used: number) => void;
  deductOptimistic: (amount: number) => void;
  setLoading: (loading: boolean) => void;
  syncFromDB: (userId: string, options?: { force?: boolean }) => Promise<void>;
  reset: () => void;
}

import { monthlyTokensForPlan, normalizePlanId } from "@/lib/billing/plans";

/** Monthly quota for the free plan — used as default before first DB sync. */
export const FREE_MONTHLY_QUOTA = 30;

/** Monthly token allowance shown in UI for each plan tier. */
export function getMonthlyTokenQuotaForPlan(planId: string | undefined): number {
  return monthlyTokensForPlan(normalizePlanId(planId ?? "free"));
}

export const useCreditsStore = create<CreditsState>()((set, get) => ({
  remaining: FREE_MONTHLY_QUOTA,
  planAllowance: FREE_MONTHLY_QUOTA,
  resetAt: null,
  totalUsedThisPeriod: 0,
  loading: false,
  lastSyncedAt: null,
  isConfirmed: false,

  setCredits: (remaining, resetAt, planAllowance) =>
    set({
      remaining,
      resetAt: resetAt ?? get().resetAt,
      planAllowance: planAllowance ?? get().planAllowance,
      lastSyncedAt: Date.now(),
      isConfirmed: true,
    }),

  setUsed: (totalUsedThisPeriod) => set({ totalUsedThisPeriod }),

  deductOptimistic: (amount) =>
    set((s) => ({
      remaining: Math.max(0, s.remaining - amount),
      totalUsedThisPeriod: s.totalUsedThisPeriod + amount,
    })),

  setLoading: (loading) => set({ loading }),

  syncFromDB: async (_userId: string, options?: { force?: boolean }) => {
    const { lastSyncedAt, loading } = get();
    if (!options?.force && (loading || (lastSyncedAt && Date.now() - lastSyncedAt < 30_000))) return;

    set({ loading: true });
    try {
      const res = await fetch("/api/credits");
      if (!res.ok) throw new Error("Failed to fetch credits");
      const data = await res.json();

      // Only treat as 0 if the server explicitly returned a confirmed 0.
      // If data.remaining is undefined/null the wallet may not be initialized yet
      // — fall back to the free plan quota so we don't block generation.
      const serverValue = data.balance ?? data.remaining;
      const remaining = typeof serverValue === "number"
        ? Math.max(0, serverValue)
        : FREE_MONTHLY_QUOTA;
      const planAllowance =
        typeof data.plan_allowance === "number"
          ? data.plan_allowance
          : typeof data.quota === "number"
            ? data.quota
            : FREE_MONTHLY_QUOTA;

      set({
        remaining,
        planAllowance,
        resetAt: data.reset_at ?? null,
        totalUsedThisPeriod: data.used_this_period ?? data.total_used ?? 0,
        loading: false,
        lastSyncedAt: Date.now(),
        isConfirmed: typeof serverValue === "number",
      });
    } catch {
      // On network error, don't mark as confirmed — keep the default quota
      set({ loading: false });
    }
  },

  reset: () =>
    set({
      remaining: FREE_MONTHLY_QUOTA,
      planAllowance: FREE_MONTHLY_QUOTA,
      resetAt: null,
      totalUsedThisPeriod: 0,
      loading: false,
      lastSyncedAt: null,
      isConfirmed: false,
    }),
}));
