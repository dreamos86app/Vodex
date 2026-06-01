/**
 * Single entry for credits hydration — prevents duplicate /api/credits on mount.
 */
import type { Profile } from "@/lib/supabase/types";
import { seedCreditsFromProfile } from "@/lib/credits/seed-credits-from-profile";
import { markCreditsFirstPaint } from "@/lib/credits/credits-local-cache";
import { hydrateCreditsFromLocalCache, useCreditsStore } from "@/lib/stores/credits-store";

export const CREDITS_LITE_TTL_MS = 25_000;

let lastLiteFetchAt = 0;
let bootstrapCompletedForUser: string | null = null;
let duplicateFetchBlocked = 0;

function logCreditsDev(label: string, detail?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.info(`[credits] ${label}`, detail ?? "");
  }
}

export function creditsDuplicateFetchBlockedCount(): number {
  return duplicateFetchBlocked;
}

export function shouldSkipLiteCreditsFetch(userId: string): boolean {
  const state = useCreditsStore.getState();
  if (state.isConfirmed && state.lastSyncedAt && Date.now() - state.lastSyncedAt < CREDITS_LITE_TTL_MS) {
    return true;
  }
  if (Date.now() - lastLiteFetchAt < CREDITS_LITE_TTL_MS && bootstrapCompletedForUser === userId) {
    duplicateFetchBlocked += 1;
    logCreditsDev("credits_duplicate_fetch_blocked", { userId, count: duplicateFetchBlocked });
    return true;
  }
  return false;
}

export function markLiteCreditsFetched(userId: string): void {
  lastLiteFetchAt = Date.now();
  bootstrapCompletedForUser = userId;
}

/** Run once per session user — profile + cache first, then single lite fetch. */
export function runCreditsBootstrap(userId: string, profile?: Partial<Profile> | null): void {
  if (!userId) return;

  hydrateCreditsFromLocalCache(userId);
  if (profile?.id) {
    seedCreditsFromProfile(profile as Profile);
    markCreditsFirstPaint(userId);
  }

  if (shouldSkipLiteCreditsFetch(userId)) {
    const s = useCreditsStore.getState();
    if (s.syncing && (s.build.available > 0 || s.action.available > 0)) {
      useCreditsStore.setState({ syncing: false, loading: false });
    }
    return;
  }

  if (bootstrapCompletedForUser === userId && useCreditsStore.getState().isConfirmed) {
    return;
  }

  bootstrapCompletedForUser = userId;
  const syncClearTimer = setTimeout(() => {
    const s = useCreditsStore.getState();
    if (!s.isConfirmed && s.syncing) {
      useCreditsStore.setState({ syncing: false, loading: false });
    }
  }, 1200);

  void useCreditsStore.getState().syncFromDB({ reason: "bootstrap" }).then((payload) => {
    clearTimeout(syncClearTimer);
    if (payload) markLiteCreditsFetched(userId);
    else {
      const s = useCreditsStore.getState();
      if (s.build.available > 0 || s.action.available > 0 || s.lastSyncedAt) {
        useCreditsStore.setState({ syncing: false, loading: false, isConfirmed: Boolean(s.lastSyncedAt) });
      } else {
        useCreditsStore.setState({ syncing: false, loading: false });
      }
    }
  });
}

export function resetCreditsBootstrap(): void {
  bootstrapCompletedForUser = null;
  lastLiteFetchAt = 0;
}
