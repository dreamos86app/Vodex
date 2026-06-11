import type { CanonicalCreditsPayload } from "@/lib/credits/canonical-credits";

/** v3 — invalidate stale plan-allowance action balances from older caches */
const KEY_PREFIX = "vodex:credits:v3:";

type CachedCredits = CanonicalCreditsPayload & { savedAt: number };

export function loadCreditsLocalCache(userId: string): CanonicalCreditsPayload | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const raw = localStorage.getItem(`${KEY_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCredits;
    if (!parsed.build || !parsed.action) return null;
    if (parsed.savedAt && Date.now() - parsed.savedAt > 7 * 24 * 60 * 60 * 1000) return null;
    return {
      build: parsed.build,
      action: parsed.action,
      planId: parsed.planId,
    };
  } catch {
    return null;
  }
}

export function loadCreditsLocalCacheWithMeta(
  userId: string,
): (CanonicalCreditsPayload & { savedAt: number }) | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const raw = localStorage.getItem(`${KEY_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCredits;
    if (!parsed.build || !parsed.action) return null;
    return {
      build: parsed.build,
      action: parsed.action,
      planId: parsed.planId,
      savedAt: parsed.savedAt ?? 0,
    };
  } catch {
    return null;
  }
}

export function saveCreditsLocalCache(userId: string, payload: CanonicalCreditsPayload): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    const data: CachedCredits = { ...payload, savedAt: Date.now() };
    localStorage.setItem(`${KEY_PREFIX}${userId}`, JSON.stringify(data));
  } catch {
    /* quota */
  }
}

export function markCreditsFirstPaint(userId: string): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    const nav =
      typeof performance !== "undefined" && performance.getEntriesByType
        ? (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)
        : undefined;
    const ms = nav ? Math.round(performance.now()) : 0;
    sessionStorage.setItem(`${KEY_PREFIX}first-paint:${userId}`, String(ms));
    if (process.env.NODE_ENV === "development") {
      console.info(`[credits] credits_first_paint_ms=${ms}`);
    }
  } catch {
    /* ignore */
  }
}
