"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { INTRO_SESSION_KEY } from "@/lib/session/session-intro-decision";
import { IntroBackground } from "@/components/session/intro/IntroBackground";
import { IntroAppPanel } from "@/components/session/intro/IntroAppPanel";
import { IntroVortex } from "@/components/session/intro/IntroVortex";
import { IntroLogoReveal } from "@/components/session/intro/IntroLogoReveal";
import { INTRO_CINEMATIC_APPS } from "@/components/session/intro/intro-apps";
import {
  COLLAPSE_END_S,
  INTRO_TOTAL_MS,
  SHOWCASE_END_S,
} from "@/components/session/intro/intro-constants";

export function VodexSessionIntro({
  show,
  onDone,
  onVisible,
}: {
  show: boolean;
  onDone: () => void;
  onVisible?: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = React.useState<"hidden" | "show" | "exit">("hidden");
  const [timeline, setTimeline] = React.useState(0);
  const doneRef = React.useRef(false);
  const visibleReported = React.useRef(false);

  const finish = React.useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setPhase("hidden");
    onDone();
  }, [onDone]);

  React.useEffect(() => {
    if (!show) {
      setPhase("hidden");
      setTimeline(0);
      visibleReported.current = false;
      return;
    }
    doneRef.current = false;
    setPhase("show");
    if (!visibleReported.current) {
      visibleReported.current = true;
      onVisible?.();
    }
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      setTimeline((now - t0) / 1000);
      if (now - t0 < INTRO_TOTAL_MS) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const exitAt = window.setTimeout(() => setPhase("exit"), INTRO_TOTAL_MS - 420);
    const doneAt = window.setTimeout(finish, INTRO_TOTAL_MS);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(exitAt);
      window.clearTimeout(doneAt);
    };
  }, [show, finish, onVisible]);

  if (phase === "hidden") return null;

  const exiting = phase === "exit";
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const layout = isMobile ? "mobile" : "desktop";

  const inShowcase = timeline < SHOWCASE_END_S;
  const collapsing = timeline >= SHOWCASE_END_S && timeline < COLLAPSE_END_S;
  const inBrand = timeline >= COLLAPSE_END_S;
  const showBrand = reducedMotion ? timeline > 0.4 : inBrand;

  return (
    <AnimatePresence>
      <motion.div
        className={`vodex-cinematic-intro vodex-intro-v3 vodex-intro-p13 fixed inset-0 z-[9999] overflow-hidden ${exiting ? "vodex-cinematic-intro--exit" : ""}`}
        data-testid="vodex-session-intro"
        data-intro-version="p13"
        role="status"
        aria-live="polite"
        aria-label="Loading Vodex"
        initial={{ opacity: 1 }}
        animate={{ opacity: exiting ? 0 : 1 }}
        transition={{ duration: 0.4 }}
      >
        <IntroBackground reducedMotion={Boolean(reducedMotion)} />

        <motion.div
          className="vodex-intro-v3__energy vodex-intro-p13__camera-drift pointer-events-none absolute inset-0"
          animate={{ opacity: collapsing || inBrand ? 0.95 : 0.28 }}
          transition={{ duration: 0.45 }}
          aria-hidden
        />

        {(inShowcase || collapsing) && (
          <div
            className="vodex-intro-p13__stage pointer-events-none absolute inset-0"
            style={{ perspective: 1600 }}
          >
            {INTRO_CINEMATIC_APPS.map((app) => (
              <IntroAppPanel
                key={app.id}
                app={app}
                layout={layout}
                timeline={timeline}
                reducedMotion={Boolean(reducedMotion)}
              />
            ))}
          </div>
        )}

        <IntroVortex active={collapsing && !reducedMotion} />

        <IntroLogoReveal visible={showBrand} reducedMotion={Boolean(reducedMotion)} />
      </motion.div>
    </AnimatePresence>
  );
}

export function shouldShowSessionIntro(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(INTRO_SESSION_KEY) !== "1";
  } catch {
    return true;
  }
}

export function markSessionIntroSeen(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(INTRO_SESSION_KEY, "1");
  } catch {
    /* ignore */
  }
}
