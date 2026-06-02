"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { VodexBrandIcon } from "@/components/brand/vodex-brand-icon";
import { INTRO_SESSION_KEY } from "@/lib/session/session-intro-decision";
import { IntroFallingStars } from "@/components/session/intro-falling-stars";
import { INTRO_V3_APPS } from "@/components/session/intro-v3-app-screens";
import { IntroV3Collapse } from "@/components/session/intro-v3-collapse";

/** Previews visible 0.2–1.8s · vortex 1.8–2.5s · brand 2.5–3.6s */
const PREVIEW_START = 0.2;
const PHASE_MONTAGE_END = 1.8;
const PHASE_COLLAPSE_END = 2.5;
const INTRO_MS = 3600;

const CORNER_DESKTOP = [
  { x: "-34%", y: "-30%", rotate: -7, scale: 0.92 },
  { x: "34%", y: "-30%", rotate: 6, scale: 0.9 },
  { x: "-34%", y: "30%", rotate: 5, scale: 0.88 },
  { x: "34%", y: "30%", rotate: -6, scale: 0.9 },
] as const;

const CORNER_MOBILE = [
  { x: "-38%", y: "-32%", rotate: -5, scale: 0.88 },
  { x: "38%", y: "-32%", rotate: 5, scale: 0.86 },
  { x: "-38%", y: "32%", rotate: 4, scale: 0.84 },
  { x: "38%", y: "32%", rotate: -4, scale: 0.86 },
] as const;

function QuadrantApp({
  children,
  corner,
  layout,
  visible,
  collapsing,
}: {
  children: React.ReactNode;
  corner: { x: string; y: string; rotate: number; scale: number };
  layout: "desktop" | "mobile";
  visible: boolean;
  collapsing: boolean;
}) {
  const frameClass =
    layout === "mobile"
      ? "h-[min(42vh,380px)] w-[min(44vw,200px)]"
      : "h-[min(42vh,360px)] w-[min(42vw,420px)]";

  return (
    <motion.div
      className={`vodex-intro-v3__screen absolute left-1/2 top-1/2 z-[6] -translate-x-1/2 -translate-y-1/2 ${frameClass}`}
      initial={false}
      animate={
        collapsing
          ? {
              opacity: [1, 1, 0],
              scale: [corner.scale, corner.scale * 0.95, 0.15],
              x: ["0%", corner.x, "0%"],
              y: ["0%", corner.y, "0%"],
              rotate: corner.rotate,
              filter: ["blur(0px)", "blur(0px)", "blur(10px)"],
            }
          : visible
            ? {
                opacity: 1,
                scale: corner.scale,
                x: corner.x,
                y: corner.y,
                rotate: corner.rotate,
                filter: "blur(0px)",
              }
            : { opacity: 0, scale: 0.85, filter: "blur(6px)" }
      }
      transition={
        collapsing
          ? { duration: 0.7, ease: [0.55, 0, 0.2, 1] }
          : { duration: 0.45, delay: PREVIEW_START, ease: [0.22, 1, 0.36, 1] }
      }
      style={{ perspective: 1200, transformStyle: "preserve-3d" }}
    >
      <div className="vodex-intro-v3__chromatic relative h-full w-full shadow-[0_32px_80px_-16px_rgba(0,0,0,0.85)]">
        {children}
      </div>
    </motion.div>
  );
}

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
      if (now - t0 < INTRO_MS) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const exitAt = window.setTimeout(() => setPhase("exit"), INTRO_MS - 400);
    const doneAt = window.setTimeout(finish, INTRO_MS);
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
  const corners = isMobile ? CORNER_MOBILE : CORNER_DESKTOP;

  const previewsVisible = timeline >= PREVIEW_START && timeline < PHASE_MONTAGE_END;
  const collapsing = timeline >= PHASE_MONTAGE_END && timeline < PHASE_COLLAPSE_END;
  const inBrand = timeline >= PHASE_COLLAPSE_END;

  const showBrand = reducedMotion || inBrand;
  const brandDelay = reducedMotion ? 0.1 : 0;

  return (
    <AnimatePresence>
      <motion.div
        className={`vodex-cinematic-intro vodex-intro-v3 fixed inset-0 z-[9999] overflow-hidden ${exiting ? "vodex-cinematic-intro--exit" : ""}`}
        data-testid="vodex-session-intro"
        data-intro-version="v3"
        role="status"
        aria-live="polite"
        aria-label="Loading Vodex"
        initial={{ opacity: 1 }}
        animate={{ opacity: exiting ? 0 : 1 }}
        transition={{ duration: 0.4 }}
      >
        <div className="vodex-intro-v3__cosmos" aria-hidden />
        <IntroFallingStars active={!reducedMotion} />

        <motion.div
          className="vodex-intro-v3__energy pointer-events-none absolute inset-0"
          animate={{ opacity: collapsing || inBrand ? 0.95 : 0.25 }}
          transition={{ duration: 0.4 }}
          aria-hidden
        />

        {!reducedMotion && (previewsVisible || collapsing) ? (
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            {INTRO_V3_APPS.map((app, i) => {
              const Screen = app.Screen;
              return (
                <QuadrantApp
                  key={app.id}
                  corner={corners[i]!}
                  layout={layout}
                  visible={previewsVisible}
                  collapsing={collapsing}
                >
                  <Screen layout={layout} />
                </QuadrantApp>
              );
            })}
          </div>
        ) : null}

        <IntroV3Collapse active={collapsing && !reducedMotion} />

        <motion.div
          className="relative z-20 flex h-full flex-col items-center justify-center px-6 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: showBrand ? 1 : 0 }}
          transition={{ duration: 0.35 }}
        >
          <motion.div
            className="vodex-cinematic-intro__icon-wrap relative flex size-28 items-center justify-center"
            initial={{ opacity: 0, scale: 0.2 }}
            animate={showBrand ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.2 }}
            transition={{
              delay: brandDelay,
              duration: 0.6,
              type: "spring",
              stiffness: 220,
              damping: 20,
            }}
          >
            <motion.div
              className="absolute inset-0 rounded-full bg-sky-400/30 blur-2xl"
              animate={showBrand ? { scale: [0.5, 1.5, 1.2], opacity: [0, 0.9, 0.5] } : {}}
              transition={{ delay: brandDelay, duration: 0.8 }}
            />
            <VodexBrandIcon size="xl" alt="" className="vodex-cinematic-intro__icon relative size-24" />
          </motion.div>

          <div className="mt-6 flex items-center justify-center gap-[0.35em]" aria-hidden>
            {"VODEX".split("").map((ch, i) => (
              <motion.span
                key={ch + i}
                className="vodex-cinematic-intro__letter text-3xl font-semibold tracking-[0.24em] text-white"
                initial={{ opacity: 0, y: 18 }}
                animate={showBrand ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
                transition={{
                  delay: brandDelay + 0.12 + i * 0.055,
                  duration: 0.38,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {ch}
              </motion.span>
            ))}
          </div>
          <motion.p
            className="vodex-cinematic-intro__tagline mt-3 text-sm font-medium tracking-wide text-sky-100/90"
            initial={{ opacity: 0, y: 10 }}
            animate={showBrand ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
            transition={{ delay: brandDelay + 0.45, duration: 0.4 }}
          >
            Preparing your workspace
          </motion.p>
        </motion.div>
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
