/**
 * Credits lite TTL + dedupe helpers (warmup orchestration in session-credits-warmup.ts).
 */
import { useCreditsStore } from "@/lib/stores/credits-store";

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
  if (Date.now() - lastLiteFetchAt < 3_000 && bootstrapCompletedForUser === userId) {
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

export function resetCreditsBootstrap(): void {
  bootstrapCompletedForUser = null;
  lastLiteFetchAt = 0;
}
