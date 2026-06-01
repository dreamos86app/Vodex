"use client";

import * as React from "react";

/** True after first paint + idle (or timeout) — defer heavy chrome hydration. */
export function useIdleReady(timeoutMs = 120): boolean {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    if (ready) return;
    let cancelled = false;
    const run = () => {
      if (!cancelled) setReady(true);
    };
    const ric = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1));
    const cancelRic =
      window.cancelIdleCallback ??
      ((id: number) => {
        window.clearTimeout(id);
      });
    const id = ric(run);
    const t = window.setTimeout(run, timeoutMs);
    return () => {
      cancelled = true;
      cancelRic(id as number);
      window.clearTimeout(t);
    };
  }, [ready, timeoutMs]);

  return ready;
}
