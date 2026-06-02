"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { INTRO_SESSION_KEY } from "@/lib/session/session-intro-decision";
import { IntroBackground } from "@/components/session/intro/IntroBackground";
import { CinematicAppPanel } from "@/components/session/intro/CinematicAppPanel";
import { IntroVortex } from "@/components/session/intro/IntroVortex";
import { IntroLogoReveal } from "@/components/session/intro/IntroLogoReveal";
import { INTRO_CINEMATIC_APPS } from "@/components/session/intro/intro-apps";
import { preloadIntroReferenceImages } from "@/components/session/intro/intro-image-preload";
import {
  COLLAPSE_END_S,
  EXIT_FADE_MS,
  LOGO_REVEAL_START_S,
  POST_REVEAL_SETTLE_MS,
  SHOWCASE_END_S,
  SHOWCASE_START_S,
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
  const [revealComplete, setRevealComplete] = React.useState(false);
  const doneRef = React.useRef(false);
  const visibleReported = React.useRef(false);
  const startedAtRef = React.useRef(0);

  const finish = React.useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setPhase("hidden");
    onDone();
  }, [onDone]);

  const beginExit = React.useCallback(() => {
    if (doneRef.current) return;
    setPhase("exit");
    window.setTimeout(finish, EXIT_FADE_MS);
  }, [finish]);

  const handleRevealComplete = React.useCallback(() => {
    setRevealComplete(true);
  }, []);

  React.useEffect(() => {
    if (show) preloadIntroReferenceImages();
  }, [show]);

  React.useEffect(() => {
    if (!show) {
      setPhase("hidden");
      setTimeline(0);
      setRevealComplete(false);
      visibleReported.current = false;
      return;
    }
    doneRef.current = false;
    setPhase("show");
    setRevealComplete(false);
    startedAtRef.current = performance.now();
    if (!visibleReported.current) {
      visibleReported.current = true;
      onVisible?.();
    }
    let raf = 0;
    const tick = (now: number) => {
      setTimeline((now - startedAtRef.current) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [show, onVisible]);

  React.useEffect(() => {
    if (!show || !revealComplete) return;
    const t = window.setTimeout(beginExit, POST_REVEAL_SETTLE_MS);
    return () => window.clearTimeout(t);
  }, [show, revealComplete, beginExit]);

  if (phase === "hidden") return null;

  const exiting = phase === "exit";
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const layout = isMobile ? "mobile" : "desktop";

  const envReady = timeline >= SHOWCASE_START_S - 0.05;
  const inShowcase = timeline >= SHOWCASE_START_S && timeline < SHOWCASE_END_S;
  const collapsing = timeline >= SHOWCASE_END_S && timeline < COLLAPSE_END_S;
  const inBrand = timeline >= LOGO_REVEAL_START_S;
  const showBrand = reducedMotion ? timeline > 0.5 : inBrand;

  return (
    <AnimatePresence>
      <motion.div
        className={`vodex-cinematic-intro vodex-intro-v3 vodex-intro-p13 vodex-intro-p14 fixed inset-0 z-[9999] overflow-hidden ${exiting ? "vodex-cinematic-intro--exit" : ""}`}
        data-testid="vodex-session-intro"
        data-intro-version="p14"
        role="status"
        aria-live="polite"
        aria-label="Loading Vodex"
        initial={{ opacity: 1 }}
        animate={{ opacity: exiting ? 0 : 1 }}
        transition={{ duration: EXIT_FADE_MS / 1000 }}
      >
        <IntroBackground reducedMotion={Boolean(reducedMotion)} />

        <motion.div
          className="vodex-intro-v3__energy vodex-intro-p13__camera-drift pointer-events-none absolute inset-0"
          animate={{ opacity: collapsing || inBrand ? 0.92 : envReady ? 0.32 : 0 }}
          transition={{ duration: 0.5 }}
          aria-hidden
        />

        {(inShowcase || collapsing) && (
          <div
            className="vodex-intro-p13__stage pointer-events-none absolute inset-0"
            style={{ perspective: 1700 }}
          >
            {INTRO_CINEMATIC_APPS.map((app) => (
              <CinematicAppPanel
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

        <IntroLogoReveal
          visible={showBrand}
          reducedMotion={Boolean(reducedMotion)}
          onRevealComplete={handleRevealComplete}
        />
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
