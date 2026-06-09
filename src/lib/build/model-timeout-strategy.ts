/** Per-build timeout escalation — never retry the same failing prompt 6 times. */

export type ModelTimeoutStrategy = "normal" | "smaller_chunk" | "route_by_route" | "paused";

export const MAX_SAME_STAGE_TIMEOUTS = 2;
export const MAX_GLOBAL_TIMEOUTS_BEFORE_PAUSE = 3;

export type TimeoutStrategyState = {
  globalTimeouts: number;
  stageTimeouts: Map<string, number>;
  strategy: ModelTimeoutStrategy;
  paused: boolean;
  pauseReason?: string;
};

export function createTimeoutStrategyState(): TimeoutStrategyState {
  return {
    globalTimeouts: 0,
    stageTimeouts: new Map(),
    strategy: "normal",
    paused: false,
  };
}

export function recordModelTimeout(
  state: TimeoutStrategyState,
  stageId: string,
): TimeoutStrategyState {
  const next = { ...state, stageTimeouts: new Map(state.stageTimeouts) };
  const stageCount = (next.stageTimeouts.get(stageId) ?? 0) + 1;
  next.stageTimeouts.set(stageId, stageCount);
  next.globalTimeouts += 1;

  if (next.globalTimeouts >= MAX_GLOBAL_TIMEOUTS_BEFORE_PAUSE && next.strategy === "route_by_route") {
    next.paused = true;
    next.strategy = "paused";
    next.pauseReason =
      "Generation paused — the model did not return usable files in time. Continue generation will resume route-by-route.";
    return next;
  }

  if (stageCount >= MAX_SAME_STAGE_TIMEOUTS || next.globalTimeouts >= MAX_SAME_STAGE_TIMEOUTS) {
    next.strategy = "route_by_route";
    return next;
  }

  if (stageCount === 1) {
    next.strategy = "smaller_chunk";
  }
  return next;
}

export function shouldPauseAfterTimeout(state: TimeoutStrategyState): boolean {
  return state.paused || state.globalTimeouts >= MAX_GLOBAL_TIMEOUTS_BEFORE_PAUSE;
}

export function userMessageForTimeoutStrategy(strategy: ModelTimeoutStrategy): string {
  switch (strategy) {
    case "smaller_chunk":
      return "Some screens are still incomplete, so I'm continuing generation with a smaller scope.";
    case "route_by_route":
      return "The model did not return enough usable files, so I'm switching to route-by-route generation.";
    case "paused":
      return "Generation paused — the model did not return usable files in time. Continue generation will resume route-by-route.";
    default:
      return "Core layout is ready. I'm adding dashboard and feature screens next.";
  }
}
