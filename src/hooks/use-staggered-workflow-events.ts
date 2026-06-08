"use client";

import * as React from "react";
import type { AgentWorkflowEvent } from "@/lib/build/workflow-stream-types";

const STAGGER_MS = 160;

/** Reveal workflow rows one-by-one during file extraction / batch persist. */
export function useStaggeredWorkflowEvents(
  events: AgentWorkflowEvent[],
  enabled: boolean,
): AgentWorkflowEvent[] {
  const [visibleCount, setVisibleCount] = React.useState(events.length);

  React.useEffect(() => {
    if (!enabled) {
      setVisibleCount(events.length);
    }
  }, [enabled, events.length]);

  React.useEffect(() => {
    if (!enabled) return;
    if (visibleCount >= events.length) return;
    const id = setTimeout(
      () => setVisibleCount((v) => Math.min(v + 1, events.length)),
      STAGGER_MS,
    );
    return () => clearTimeout(id);
  }, [enabled, events.length, visibleCount]);

  return events.slice(0, enabled ? visibleCount : events.length);
}
