import type { RouteOperationContext } from "@/lib/ai/model-router";

/** No single chunked model call may wait longer than 25s without failover. */
export const CHUNK_MODEL_TIMEOUT_MS = 25_000;

/** Hard caps for build pipeline provider calls (ms). */
export const PROVIDER_TIMEOUT_MS: Partial<
  Record<RouteOperationContext["operationType"] | string, number>
> = {
  build_intake: 30_000,
  build_plan: 30_000,
  schema_design: 30_000,
  ui_design_plan: 30_000,
  /** Chunked generation uses 25s per chunk; legacy single-pass cap kept for smoke paths. */
  frontend_implementation: CHUNK_MODEL_TIMEOUT_MS,
  frontend_implementation_legacy: 90_000,
  backend_implementation: 60_000,
  code_repair_small: 60_000,
  code_repair_hard: 60_000,
  app_identity: 20_000,
  logo_generation: 20_000,
  build_summary: 20_000,
};

export function timeoutForOperationType(operationType: string): number | undefined {
  return PROVIDER_TIMEOUT_MS[operationType];
}

export function isProviderTimeoutError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: string }).name;
  const message = String((err as { message?: string }).message ?? err);
  return (
    name === "AbortError" ||
    name === "TimeoutError" ||
    /aborted|timeout|timed out/i.test(message)
  );
}
