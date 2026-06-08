"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

const TICK_MS = 1000;

function estimateTargetLines(path: string): { added: number; removed: number } {
  const p = path.toLowerCase();
  if (/page\.(tsx|jsx)$/.test(p)) return { added: 72, removed: 0 };
  if (/layout\.(tsx|jsx)$/.test(p)) return { added: 48, removed: 0 };
  if (/globals\.css$/.test(p)) return { added: 36, removed: 0 };
  if (/mock-data|lib\//.test(p)) return { added: 96, removed: 0 };
  if (/components\//.test(p)) return { added: 64, removed: 0 };
  return { added: 52, removed: 0 };
}

/** Live +/− counters — tick at most once per second, smooth steps, blue + / red −. */
export function LiveFileLineDelta({
  path,
  active,
  added,
  removed,
  className,
}: {
  path: string;
  active: boolean;
  added?: number;
  removed?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const target = estimateTargetLines(path);
  const hasReal = typeof added === "number" || typeof removed === "number";
  const finalAdded = typeof added === "number" ? added : active ? target.added : 0;
  const finalRemoved = typeof removed === "number" ? removed : 0;

  const [displayAdded, setDisplayAdded] = React.useState(0);
  const [displayRemoved, setDisplayRemoved] = React.useState(0);
  const goalRef = React.useRef({ added: finalAdded, removed: finalRemoved });

  React.useEffect(() => {
    goalRef.current = { added: finalAdded, removed: finalRemoved };
  }, [finalAdded, finalRemoved]);

  React.useEffect(() => {
    if (!active && hasReal) {
      setDisplayAdded(finalAdded);
      setDisplayRemoved(finalRemoved);
      return;
    }
    if (!active && !hasReal) {
      setDisplayAdded(0);
      setDisplayRemoved(0);
      return;
    }

    if (reduced) {
      setDisplayAdded(finalAdded);
      setDisplayRemoved(finalRemoved);
      return;
    }

    const tick = () => {
      const goal = goalRef.current;
      setDisplayAdded((prev) => {
        if (prev >= goal.added) return goal.added;
        const step = Math.max(1, Math.ceil((goal.added - prev) / 4));
        return Math.min(goal.added, prev + step);
      });
      setDisplayRemoved((prev) => {
        if (prev >= goal.removed) return goal.removed;
        const step = Math.max(1, Math.ceil((goal.removed - prev) / 4));
        return Math.min(goal.removed, prev + step);
      });
    };

    tick();
    const id = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(id);
  }, [active, hasReal, finalAdded, finalRemoved, reduced]);

  if (!active && !hasReal && displayAdded === 0 && displayRemoved === 0) {
    return null;
  }

  const showAdded = active || displayAdded > 0 || hasReal;
  const showRemoved = active || displayRemoved > 0 || (hasReal && (removed ?? 0) > 0);

  return (
    <span
      className={cn("flex shrink-0 items-center gap-1.5 font-mono text-[10px] tabular-nums", className)}
      data-testid="live-file-line-delta"
    >
      {showAdded ? (
        <span
          className={cn(
            "inline-flex min-w-[2.25rem] items-center justify-end font-semibold text-blue-500 transition-all duration-500 ease-out",
            active && "animate-[pulse_1.4s_ease-in-out_infinite]",
          )}
        >
          +{displayAdded}
        </span>
      ) : null}
      {showRemoved || active ? (
        <span
          className={cn(
            "inline-flex min-w-[2.25rem] items-center font-semibold text-red-500 transition-all duration-500 ease-out",
            active && "animate-[pulse_1.4s_ease-in-out_infinite]",
          )}
        >
          −{displayRemoved}
        </span>
      ) : null}
    </span>
  );
}
