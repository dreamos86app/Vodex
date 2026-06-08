import { callProviderStructured, type ProviderCallResult } from "@/lib/ai/provider-call";
import type { ProviderCallInput } from "@/lib/ai/provider-call";
import { isProviderTimeoutError } from "@/lib/ai/provider-timeouts";
import type {
  BuildWorkerTraceSnapshot,
} from "@/lib/build/build-worker-trace";
import {
  traceModelCallEnded,
  traceModelCallStarted,
} from "@/lib/build/build-worker-trace";

export type TimedProviderResult =
  | { ok: true; result: ProviderCallResult }
  | { ok: false; timedOut: boolean; error: string };

export async function callProviderWithBuildTimeout(
  input: ProviderCallInput & { operationType: string },
  trace?: BuildWorkerTraceSnapshot | null,
): Promise<TimedProviderResult> {
  if (trace) {
    traceModelCallStarted(trace, {
      operationType: input.operationType,
      timeoutMs: input.timeoutMs ?? 30_000,
    });
  }

  const timeoutMs = input.timeoutMs ?? 30_000;
  try {
    const raced = await withTimeout(
      callProviderStructured(input),
      timeoutMs + 5_000,
      input.operationType,
    );
    if (!raced.ok) {
      if (trace) traceModelCallEnded(trace, "timeout", input.operationType);
      return { ok: false, timedOut: true, error: `timeout:${input.operationType}` };
    }
    const result = raced.value;
    if (trace) traceModelCallEnded(trace, "finished", input.operationType);
    return { ok: true, result };
  } catch (err) {
    const timedOut = isProviderTimeoutError(err);
    if (trace) {
      traceModelCallEnded(trace, timedOut ? "timeout" : "failed", String(err));
    }
    return {
      ok: false,
      timedOut,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<{ ok: true; value: T } | { ok: false; timedOut: true; label: string }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const value = await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timeout:${label}`)), timeoutMs);
      }),
    ]);
    return { ok: true, value };
  } catch (err) {
    if (isProviderTimeoutError(err) || String(err).includes(`timeout:${label}`)) {
      return { ok: false, timedOut: true, label };
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
