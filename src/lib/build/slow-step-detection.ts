export const SLOW_STEP_THRESHOLDS_MS: Record<string, number> = {
  planning: 10_000,
  naming: 8_000,
  icon: 20_000,
  writing: 45_000,
  validation: 15_000,
  preview_render: 25_000,
  full_build: 120_000,
};

export type SlowStepEvent = {
  stepId: string;
  label: string;
  durationMs: number;
  thresholdMs: number;
  at: string;
};

export function detectSlowStep(
  stepId: string,
  label: string,
  startedAtMs: number,
  endedAtMs = Date.now(),
): SlowStepEvent | null {
  const thresholdMs = SLOW_STEP_THRESHOLDS_MS[stepId];
  if (!thresholdMs) return null;
  const durationMs = endedAtMs - startedAtMs;
  if (durationMs <= thresholdMs) return null;
  return {
    stepId,
    label,
    durationMs,
    thresholdMs,
    at: new Date(endedAtMs).toISOString(),
  };
}

export function formatSlowStepWarning(ev: SlowStepEvent): string {
  const sec = Math.round(ev.durationMs / 1000);
  return `Slow step detected: ${ev.stepId} took ${sec}s`;
}
