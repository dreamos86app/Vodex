type CacheEntry<T> = { value: T; at: number };

const store = new Map<string, CacheEntry<unknown>>();
const TTL_MS = 15 * 60 * 1000;

let hits = 0;
let misses = 0;

export function getGenerationCache<T>(namespace: string, key: string): T | null {
  const id = `${namespace}:${key}`;
  const row = store.get(id);
  if (!row) {
    misses += 1;
    return null;
  }
  if (Date.now() - row.at > TTL_MS) {
    store.delete(id);
    misses += 1;
    return null;
  }
  hits += 1;
  return row.value as T;
}

export function setGenerationCache<T>(namespace: string, key: string, value: T): void {
  store.set(`${namespace}:${key}`, { value, at: Date.now() });
}

export function getCacheStats(): { hits: number; misses: number; hitRate: number } {
  const total = hits + misses;
  return {
    hits,
    misses,
    hitRate: total > 0 ? hits / total : 0,
  };
}

export function clearGenerationCache(): void {
  store.clear();
}
