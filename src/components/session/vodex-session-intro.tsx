"use client";

import * as React from "react";
import { VodexBrandIcon } from "@/components/brand/vodex-brand-icon";

const INTRO_KEY = "vodex_intro_seen_session";
const MAX_MS = 2400;

export function VodexSessionIntro({
  show,
  onDone,
}: {
  show: boolean;
  onDone: () => void;
}) {
  const [visible, setVisible] = React.useState(show);
  const doneRef = React.useRef(false);

  const finish = React.useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    try {
      sessionStorage.setItem(INTRO_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
    onDone();
  }, [onDone]);

  React.useEffect(() => {
    if (!show) {
      setVisible(false);
      return;
    }
    setVisible(true);
    doneRef.current = false;
    const t = window.setTimeout(finish, MAX_MS);
    return () => window.clearTimeout(t);
  }, [show, finish]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-background"
      data-testid="vodex-session-intro"
      role="status"
      aria-live="polite"
      aria-label="Loading Vodex"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,color-mix(in_oklab,var(--accent)_22%,transparent),transparent_70%)]" />
      <div className="relative flex flex-col items-center gap-4 px-6 text-center motion-reduce:animate-none">
        <div className="relative">
          <div className="absolute -inset-6 animate-pulse rounded-full bg-accent/20 blur-2xl motion-reduce:animate-none" />
          <VodexBrandIcon size="xl" alt="" className="relative size-16" />
        </div>
        <p className="text-lg font-semibold tracking-[0.28em] text-foreground">VODEX</p>
        <p className="text-[12px] text-muted-foreground">Preparing your workspace</p>
      </div>
    </div>
  );
}

export function shouldShowSessionIntro(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(INTRO_KEY) !== "1";
  } catch {
    return false;
  }
}

export function markSessionIntroSeen(): void {
  try {
    sessionStorage.setItem(INTRO_KEY, "1");
  } catch {
    /* ignore */
  }
}
