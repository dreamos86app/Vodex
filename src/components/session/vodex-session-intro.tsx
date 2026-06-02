"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { VodexBrandIcon } from "@/components/brand/vodex-brand-icon";
import { INTRO_SESSION_KEY } from "@/lib/session/session-intro-decision";
import { IntroFallingStars } from "@/components/session/intro-falling-stars";
import { INTRO_V3_APPS } from "@/components/session/intro-v3-app-screens";
import { IntroV3Collapse } from "@/components/session/intro-v3-collapse";

/** Phase 1 montage · Phase 2 collapse · Phase 3 brand */
const PHASE_MONTAGE_END = 1.8;
const PHASE_COLLAPSE_END = 2.7;
const INTRO_MS = 4000;

const CUT_DURATION = PHASE_MONTAGE_END / INTRO_V3_APPS.length;

function IntroAppFrame({
  children,
  layout,
  active,
  cutIndex,
  reducedMotion,
}: {
  children: React.ReactNode;
  layout: "desktop" | "mobile";
  active: boolean;
  cutIndex: number;
  reducedMotion: boolean;
}) {
  const start = cutIndex * CUT_DURATION;

  const frameClass =
    layout === "mobile"
      ? "h-[min(72vh,520px)] w-[min(46vw,240px)]"
      : "h-[min(58vh,440px)] w-[min(88vw,780px)]";

  return (
    <motion.div
      className={`vodex-intro-v3__screen absolute left-1/2 top-1/2 z-[6] -translate-x-1/2 -translate-y-1/2 ${frameClass}`}
      initial={false}
      animate={
        reducedMotion
          ? { opacity: active ? 1 : 0, scale: 1, x: 0, y: 0, rotateX: 0, rotateY: 0, filter: "blur(0px)" }
          : active
            ? {
                opacity: [0, 1, 1, 0],
                scale: [0.88, 1, 1, 0.92],
                x: [layout === "mobile" ? 40 : 80, 0, 0, layout === "mobile" ? -30 : -60],
                y: [20, 0, 0, -10],
                rotateY: [layout === "mobile" ? 8 : 6, 0, 0, -4],
                rotateX: [4, 0, 0, 2],
                filter: ["blur(8px)", "blur(0px)", "blur(0px)", "blur(6px)"],
              }
            : { opacity: 0, scale: 0.85, filter: "blur(8px)" }
      }
      transition={
        reducedMotion
          ? { duration: 0.2 }
          : {
              duration: CUT_DURATION + 0.15,
              delay: start,
              times: [0, 0.12, 0.82, 1],
              ease: [0.22, 1, 0.36, 1],
            }
      }
      style={{
        perspective: 1200,
        transformStyle: "preserve-3d",
        pointerEvents: "none",
      }}
      aria-hidden={!active}
    >
      <div className="vodex-intro-v3__chromatic relative h-full w-full">{children}</div>
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

    const exitAt = window.setTimeout(() => setPhase("exit"), INTRO_MS - 420);
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

  const inMontage = timeline < PHASE_MONTAGE_END;
  const inCollapse = timeline >= PHASE_MONTAGE_END && timeline < PHASE_COLLAPSE_END;
  const inBrand = timeline >= PHASE_COLLAPSE_END;

  const activeCutIndex = reducedMotion
    ? 0
    : Math.min(INTRO_V3_APPS.length - 1, Math.floor(timeline / CUT_DURATION));

  const brandDelay = reducedMotion ? 0.12 : 0;
  const showBrand = reducedMotion || inBrand;

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
        transition={{ duration: 0.42 }}
      >
        <div className="vodex-intro-v3__cosmos" aria-hidden />
        <IntroFallingStars active={!reducedMotion} />

        <motion.div
          className="vodex-intro-v3__energy pointer-events-none absolute inset-0"
          animate={{
            opacity: inCollapse || inBrand ? 0.9 : 0.35,
            scale: inCollapse ? 1.15 : 1,
          }}
          transition={{ duration: 0.5 }}
          aria-hidden
        />

        {(inMontage || reducedMotion) && (
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            {INTRO_V3_APPS.map((app, i) => {
              const Screen = app.Screen;
              const isActive = reducedMotion ? i === 0 : i === activeCutIndex && inMontage;
              return (
                <IntroAppFrame
                  key={app.id}
                  layout={layout}
                  active={isActive}
                  cutIndex={i}
                  reducedMotion={!!reducedMotion}
                >
                  <Screen layout={layout} />
                </IntroAppFrame>
              );
            })}
          </div>
        )}

        <IntroV3Collapse active={inCollapse && !reducedMotion} />

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
              className="absolute inset-0 rounded-full bg-sky-400/25 blur-2xl"
              animate={showBrand ? { scale: [0.5, 1.4, 1.2], opacity: [0, 0.8, 0.5] } : {}}
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
                  delay: brandDelay + 0.15 + i * 0.055,
                  duration: 0.4,
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
            transition={{ delay: brandDelay + 0.55, duration: 0.45 }}
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
