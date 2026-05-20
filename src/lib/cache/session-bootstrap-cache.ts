import type { Profile } from "@/lib/supabase/types";
import type { Notification } from "@/lib/supabase/types";

type BootstrapSnapshot = {
  profile: Profile | null;
  notifications: Notification[];
  fetchedAt: number;
};

const TTL_MS = 60_000;
const cache = new Map<string, BootstrapSnapshot>();
const inflight = new Map<string, Promise<BootstrapSnapshot | null>>();

export function getCachedBootstrap(userId: string): BootstrapSnapshot | null {
  const hit = cache.get(userId);
  if (!hit) return null;
  if (Date.now() - hit.fetchedAt > TTL_MS) {
    cache.delete(userId);
    return null;
  }
  return hit;
}

export function setCachedBootstrap(userId: string, snapshot: Omit<BootstrapSnapshot, "fetchedAt">): void {
  cache.set(userId, { ...snapshot, fetchedAt: Date.now() });
}

export function invalidateBootstrapCache(userId?: string): void {
  if (userId) {
    cache.delete(userId);
    inflight.delete(userId);
    return;
  }
  cache.clear();
  inflight.clear();
}

export async function loadBootstrapDeduped(
  userId: string,
  loader: () => Promise<BootstrapSnapshot | null>,
): Promise<BootstrapSnapshot | null> {
  const cached = getCachedBootstrap(userId);
  if (cached) return cached;

  const running = inflight.get(userId);
  if (running) return running;

  const promise = loader()
    .then((snap) => {
      if (snap) cache.set(userId, snap);
      return snap;
    })
    .finally(() => {
      if (inflight.get(userId) === promise) inflight.delete(userId);
    });

  inflight.set(userId, promise);
  return promise;
}
