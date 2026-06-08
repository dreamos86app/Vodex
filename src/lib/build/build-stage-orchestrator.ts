/**
 * P1.3.15 — Honest build stage runner with heartbeats and duration metadata.
 */
import type { CanonicalBuildStage, BuildStageEventMetadata, BuildStageStatus } from "@/lib/build/canonical-build-stages";
import {
  STAGE_USER_LABELS,
  heartbeatMessageForStage,
} from "@/lib/build/canonical-build-stages";
import type { WorkflowEvent, WorkflowEventMeta } from "@/lib/build/build-pipeline";

export type StageEmitFn = (
  type: WorkflowEvent["type"],
  label: string,
  detail?: string,
  meta?: WorkflowEventMeta,
) => void;

export type StageAssistantFn = (message: string) => void;

export type RunBuildStageInput<T> = {
  stage: CanonicalBuildStage;
  operationId: string;
  modelUsed?: string;
  providerUsed?: string;
  emit: StageEmitFn;
  emitAssistant?: StageAssistantFn;
  /** Heartbeat every N ms while fn is in flight (default 1800). */
  heartbeatMs?: number;
  fn: () => Promise<T>;
};

function stageMeta(
  stage: CanonicalBuildStage,
  status: BuildStageStatus,
  startedAt: string,
  extra?: Partial<BuildStageEventMetadata>,
): WorkflowEventMeta {
  return {
    streamCategory: "phase_started",
    build_stage: stage,
    stage_status: status,
    stage_started_at: startedAt,
    honest: true,
    ...extra,
  };
}

/**
 * Run one canonical stage — emits running on start, done/failed only after fn settles.
 */
export async function runBuildStage<T>(input: RunBuildStageInput<T>): Promise<T> {
  const startedAt = new Date().toISOString();
  const label = STAGE_USER_LABELS[input.stage];
  const heartbeatMs = input.heartbeatMs ?? 1800;
  let tick = 0;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

  input.emit("planning", label, label, stageMeta(input.stage, "running", startedAt, {
    actual_operation_id: input.operationId,
    model_used: input.modelUsed,
    provider_used: input.providerUsed,
  }));

  heartbeatTimer = setInterval(() => {
    const msg = heartbeatMessageForStage(input.stage, tick++);
    input.emitAssistant?.(msg);
    input.emit(
      "planning",
      label,
      msg,
      {
        ...stageMeta(input.stage, "running", startedAt, {
          actual_operation_id: input.operationId,
        }),
        heartbeat: true,
      },
    );
  }, heartbeatMs);

  try {
    const result = await input.fn();
    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - Date.parse(startedAt);
    input.emit(
      "planning",
      label,
      `${label} — done`,
      stageMeta(input.stage, "done", startedAt, {
        completed_at: completedAt,
        duration_ms: durationMs,
        actual_operation_id: input.operationId,
        model_used: input.modelUsed,
        provider_used: input.providerUsed,
      }),
    );
    return result;
  } catch (err) {
    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - Date.parse(startedAt);
    const message = err instanceof Error ? err.message : "Stage failed";
    input.emit(
      "failed",
      label,
      message,
      stageMeta(input.stage, "failed", startedAt, {
        completed_at: completedAt,
        duration_ms: durationMs,
        actual_operation_id: input.operationId,
      }),
    );
    throw err;
  } finally {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
  }
}
