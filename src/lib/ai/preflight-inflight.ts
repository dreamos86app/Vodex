import type { AiPreflightResponse } from "@/lib/ai/preflight-types";
import { runAiPreflight, type RunAiPreflightParams } from "@/lib/ai/run-preflight";

const inflight = new Map<string, Promise<AiPreflightResponse>>();

function preflightKey(params: RunAiPreflightParams): string {
  return [
    params.mode,
    params.prompt.trim().slice(0, 200),
    params.projectId ?? "",
    params.conversationId ?? "",
    params.modelId ?? "",
  ].join("|");
}

/**
 * Deduplicate concurrent preflight calls for the same session + payload.
 */
export function runAiPreflightDeduped(params: RunAiPreflightParams): Promise<AiPreflightResponse> {
  const key = preflightKey(params);
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = runAiPreflight(params).finally(() => {
    if (inflight.get(key) === promise) inflight.delete(key);
  });

  inflight.set(key, promise);
  return promise;
}

export function clearPreflightInflight(): void {
  inflight.clear();
}
