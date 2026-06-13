"use client";

import * as React from "react";

/**
 * Reveals workflow items one at a time during active builds.
 * Freezes the visible count when the build finishes so late batch events
 * do not dump dozens of rows into the chat at once.
 */
export function useSequentialWorkflowReveal<T>(
  items: T[],
  working: boolean,
  intervalMs = 360,
): T[] {
  const [visibleCount, setVisibleCount] = React.useState(0);
  const frozenCountRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (items.length === 0) {
      setVisibleCount(0);
      frozenCountRef.current = null;
    }
  }, [items.length === 0]);

  React.useEffect(() => {
    if (!working) {
      if (frozenCountRef.current === null) {
        frozenCountRef.current = visibleCount;
      }
      return;
    }
    frozenCountRef.current = null;
  }, [working, visibleCount]);

  const cap =
    !working && frozenCountRef.current !== null
      ? frozenCountRef.current
      : items.length;

  React.useEffect(() => {
    if (visibleCount >= cap) return;
    const id = window.setTimeout(() => {
      setVisibleCount((c) => Math.min(c + 1, cap));
    }, intervalMs);
    return () => window.clearTimeout(id);
  }, [visibleCount, cap, intervalMs]);

  React.useEffect(() => {
    if (working && items.length < visibleCount) {
      setVisibleCount(items.length);
    }
  }, [working, items.length, visibleCount]);

  return items.slice(0, Math.min(visibleCount, cap));
}
