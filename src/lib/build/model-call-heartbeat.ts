import type { BuildTerminalPhase } from "@/lib/build/build-terminal-state-machine";
import type { TimedProviderResult } from "@/lib/build/timed-build-operations";
import { callProviderWithBuildTimeout } from "@/lib/build/timed-build-operations";
import type { ProviderCallInput } from "@/lib/ai/provider-call";
import type { BuildWorkerTraceSnapshot } from "@/lib/build/build-worker-trace";
import { activeWorkDuringChunk, domainActiveWorkLines } from "@/lib/build/live-build-activity";

const HEARTBEAT_MS = 3_500;

export async function callProviderWithModelHeartbeat(
  input: ProviderCallInput & { operationType: string },
  ctx: {
    trace?: BuildWorkerTraceSnapshot | null;
    phase: BuildTerminalPhase;
    attempt: number;
    maxAttempts: number;
    modelLabel?: string;
    waitingOn: string;
    onHeartbeat: (message: string, elapsedMs: number) => void;
  },
): Promise<TimedProviderResult> {
  const started = Date.now();
  let tick = 0;
  const timer = setInterval(() => {
    tick += 1;
    const elapsedMs = Date.now() - started;
    const domain = domainActiveWorkLines(ctx.waitingOn);
    const line = activeWorkDuringChunk(
      { activeWork: ctx.waitingOn.endsWith("…") ? ctx.waitingOn : `${ctx.waitingOn}…`, label: ctx.waitingOn },
      tick,
      domain,
    );
    ctx.onHeartbeat(line, elapsedMs);
  }, HEARTBEAT_MS);

  try {
    return await callProviderWithBuildTimeout(input, ctx.trace);
  } finally {
    clearInterval(timer);
  }
}

export type HeartbeatWorkflowEvent = {
  type: "thinking";
  label: string;
  at: string;
  meta?: Record<string, unknown>;
};

export function emitBuildHeartbeat(
  events: HeartbeatWorkflowEvent[],
  message: string,
  emit: ((ev: HeartbeatWorkflowEvent) => void | Promise<void>) | undefined,
  meta: Record<string, unknown>,
) {
  const row: HeartbeatWorkflowEvent = {
    type: "thinking",
    label: message,
    at: new Date().toISOString(),
    meta: {
      streamCategory: "assistant_message",
      heartbeat: true,
      hidden: true,
      ...meta,
    },
  };
  events.push(row);
  void emit?.(row);
}
