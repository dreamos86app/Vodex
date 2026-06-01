import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { emitWorkflowStepFailed, emitRepairWorkflowEvent } from "@/lib/build/workflow-live-events";
import { detectSlowStep, formatSlowStepWarning } from "@/lib/build/slow-step-detection";

type Writer = SupabaseClient<Database>;

const VALIDATION_STALL_MS = 15_000;

export type ValidationWatchdogHandle = {
  cancel: () => void;
};

/** Detect silent validation stalls and emit diagnostics + repair hint. */
export function startValidationWatchdog(input: {
  writer: Writer;
  ctx: { jobId: string; projectId: string; userId: string };
  stepId?: string;
  label?: string;
  onStall?: () => void | Promise<void>;
}): ValidationWatchdogHandle {
  const started = Date.now();
  const stepId = input.stepId ?? "validation";
  const label = input.label ?? "Validating generated files";
  let cancelled = false;

  const timer = setTimeout(() => {
    if (cancelled) return;
    const slow = detectSlowStep(stepId, label, started);
    void emitWorkflowStepFailed(input.writer, input.ctx, {
      stepId,
      label: "Validation is taking longer than expected",
      message: slow
        ? formatSlowStepWarning(slow)
        : "Validation exceeded time limit — attempting repair",
      failureCode: "preview_timeout",
      metadata: { validation_stall: true, duration_ms: Date.now() - started },
    }).catch(() => undefined);
    void emitRepairWorkflowEvent(input.writer, input.ctx, {
      phase: "started",
      message: "Validation watchdog triggered deterministic repair",
    }).catch(() => undefined);
    void input.onStall?.();
  }, VALIDATION_STALL_MS);

  return {
    cancel: () => {
      cancelled = true;
      clearTimeout(timer);
    },
  };
}
