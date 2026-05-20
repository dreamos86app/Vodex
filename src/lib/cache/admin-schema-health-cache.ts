import type { SchemaHealthResult } from "@/lib/db/schema-health";

const TTL_MS = 45_000;
let cached: { at: number; data: SchemaHealthResult } | null = null;
let inflight: Promise<SchemaHealthResult> | null = null;

export function getCachedAdminSchemaHealth(
  loader: () => Promise<SchemaHealthResult>,
  force = false,
): Promise<SchemaHealthResult> {
  const now = Date.now();
  if (!force && cached && now - cached.at < TTL_MS) {
    return Promise.resolve(cached.data);
  }
  if (!force && inflight) return inflight;

  inflight = loader()
    .then((data) => {
      cached = { at: Date.now(), data };
      return data;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function bustAdminSchemaHealthCache(): void {
  cached = null;
  inflight = null;
}
