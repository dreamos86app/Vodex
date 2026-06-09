/** Persisted continuation state for resume without replanning. */

export type BuildContinuationState = {
  parentBuildJobId: string | null;
  routeByRoute: boolean;
  stageIndex: number;
  routesRemaining: string[];
  pausedAt: string;
  reason: string;
};

export function readBuildContinuationState(
  metadata: Record<string, unknown> | null | undefined,
): BuildContinuationState | null {
  const raw = metadata?.build_continuation;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  return {
    parentBuildJobId: typeof o.parent_build_job_id === "string" ? o.parent_build_job_id : null,
    routeByRoute: o.route_by_route === true,
    stageIndex: typeof o.stage_index === "number" ? o.stage_index : 0,
    routesRemaining: Array.isArray(o.routes_remaining)
      ? o.routes_remaining.filter((r): r is string => typeof r === "string")
      : [],
    pausedAt: typeof o.paused_at === "string" ? o.paused_at : new Date().toISOString(),
    reason: typeof o.reason === "string" ? o.reason : "timeout_pause",
  };
}

export function writeBuildContinuationStatePatch(
  state: BuildContinuationState,
): Record<string, unknown> {
  return {
    build_continuation: {
      parent_build_job_id: state.parentBuildJobId,
      route_by_route: state.routeByRoute,
      stage_index: state.stageIndex,
      routes_remaining: state.routesRemaining,
      paused_at: state.pausedAt,
      reason: state.reason,
    },
    continuing_generation_needed: true,
    preview_blocked: true,
  };
}

export function clearBuildContinuationStatePatch(): Record<string, unknown> {
  return {
    build_continuation: null,
    continuing_generation_needed: false,
  };
}
