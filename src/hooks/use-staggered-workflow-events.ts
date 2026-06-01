"use client";

import * as React from "react";
import type { AgentWorkflowEvent } from "@/lib/build/workflow-stream-types";

const STAGGER_MS = 140;
const BATCH_WINDOW_MS = 80;

/** Smooth same-poll batch arrivals without inventing backend events. */
export function useStaggeredWorkflowEvents(
  events: AgentWorkflowEvent[],
  enabled: boolean,
): AgentWorkflowEvent[] {
  const [visibleCount, setVisibleCount] = React.useState(events.length);

  React.useEffect(() => {
    if (!enabled) {
      setVisibleCount(events.length);
      return;
    }
    if (events.length <= visibleCount) {
      setVisibleCount(events.length);
      return;
    }
    const added = events.length - visibleCount;
    const lastAt = events[events.length - 1]?.at;
    const prevAt = events[visibleCount - 1]?.at;
    const sameBatch =
      lastAt &&
      prevAt &&
      Math.abs(Date.parse(lastAt) - Date.parse(prevAt)) < BATCH_WINDOW_MS;

    if (!sameBatch || added === 1) {
      setVisibleCount(events.length);
      return;
    }

    let i = visibleCount;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const tick = () => {
      i += 1;
      setVisibleCount(i);
      if (i < events.length) timers.push(setTimeout(tick, STAGGER_MS));
    };
    timers.push(setTimeout(tick, STAGGER_MS));
    return () => timers.forEach(clearTimeout);
  }, [events, enabled, visibleCount]);

  return events.slice(0, enabled ? visibleCount : events.length);
}
