"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { VodexBrandIcon } from "@/components/brand/vodex-brand-icon";
import { INTRO_SESSION_KEY } from "@/lib/session/session-intro-decision";
import { IntroFallingStars } from "@/components/session/intro-falling-stars";
import { INTRO_SHOWCASE_MOCKS } from "@/components/session/intro-showcase-mocks";

/** 2.5s app showcase + ~1.25s brand merge/fade */
const SHOWCASE_MS = 2500;
const BRAND_MS = 1250;
const INTRO_MS = SHOWCASE_MS + BRAND_MS + 250;

/** Corner offsets from center — TL, TR, BL, BR (desktop) */
const CORNER_DESKTOP = [
  { x: -200, y: -148, rotate: -6 },
  { x: 200, y: -148, rotate: 5 },
  { x: -200, y: 148, rotate: 4 },
  { x: 200, y: 148, rotate: -5 },
] as const;

const CORNER_MOBILE = [
  { x: -92, y: -108, rotate: -5 },
  { x: 92, y: -108, rotate: 5 },
  { x: -92, y: 108, rotate: 4 },
  { x: 92, y: 108, rotate: -4 },
] as const;

function ShowcaseSquare({
  Mock,
  corner,
  cardSize,
  reducedMotion,
  index,
}: {
  Mock: (typeof INTRO_SHOWCASE_MOCKS)[number]["Mock"];
  corner: { x: number; y: number; rotate: number };
  cardSize: number;
  reducedMotion: boolean;
  index: number;
}) {
  const enterDelay = 0.08 + index * 0.06;
  const mergeStart = SHOWCASE_MS / 1000;

  return (
    <motion.div
      className="absolute left-1/2 top-1/2 z-[5] -translate-x-1/2 -translate-y-1/2 will-change-transform"
      style={{ width: cardSize, height: cardSize }}
      initial={
        reducedMotion
          ? { opacity: 0, x: corner.x, y: corner.y, scale: 0.92 }
          : { opacity: 0, x: corner.x, y: corner.y, scale: 0.88, rotate: corner.rotate - 8 }
      }
      animate={
        reducedMotion
          ? {
              opacity: [0, 1, 1, 0],
              x: [corner.x, corner.x, 0],
              y: [corner.y, corner.y, 0],
              scale: [0.92, 1, 0.15],
            }
          : {
              opacity: [0, 1, 1, 1, 0],
              x: [corner.x, corner.x, corner.x, corner.x * 0.15, 0],
              y: [corner.y, corner.y, corner.y, corner.y * 0.15, 0],
              scale: [0.88, 1, 1, 1, 0.12],
              rotate: [corner.rotate - 8, corner.rotate, corner.rotate, corner.rotate, 0],
            }
      }
      transition={{
        duration: mergeStart + 0.7,
        delay: enterDelay,
        times: reducedMotion
          ? [0, 0.12, 0.75, 1]
          : [0, 0.1, 0.55, 0.78, 1],
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <div
        className="h-full w-full overflow-hidden rounded-xl shadow-[0_24px_64px_-12px_rgba(0,0,0,0.75)] ring-1 ring-white/25"
        style={{ transform: "translateZ(0)" }}
      >
        <Mock />
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
      visibleReported.current = false;
      return;
    }
    doneRef.current = false;
    setPhase("show");
    if (!visibleReported.current) {
      visibleReported.current = true;
      onVisible?.();
    }
    const exitAt = window.setTimeout(() => setPhase("exit"), INTRO_MS - 400);
    const doneAt = window.setTimeout(finish, INTRO_MS);
    return () => {
      window.clearTimeout(exitAt);
      window.clearTimeout(doneAt);
    };
  }, [show, finish, onVisible]);

  if (phase === "hidden") return null;

  const exiting = phase === "exit";
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const corners = isMobile ? CORNER_MOBILE : CORNER_DESKTOP;
  const cardSize = isMobile ? 112 : 168;
  const brandDelay = reducedMotion ? 0.15 : SHOWCASE_MS / 1000 + 0.05;

  return (
    <AnimatePresence>
      <motion.div
        className={`vodex-cinematic-intro vodex-intro-v2 fixed inset-0 z-[9999] overflow-hidden ${exiting ? "vodex-cinematic-intro--exit" : ""}`}
        data-testid="vodex-session-intro"
        role="status"
        aria-live="polite"
        aria-label="Loading Vodex"
        initial={{ opacity: 1 }}
        animate={{ opacity: exiting ? 0 : 1 }}
        transition={{ duration: 0.4 }}
      >
        <div className="vodex-intro-v2__sky" aria-hidden />
        <IntroFallingStars active={!reducedMotion} />

        <motion.div
          className="pointer-events-none absolute left-1/2 top-1/2 z-[4] size-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-400/20 blur-3xl"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: [0, 0, 0.85, 0.4], scale: [0.5, 0.5, 1.6, 2] }}
          transition={{
            duration: BRAND_MS / 1000 + 0.3,
            delay: brandDelay,
            ease: "easeOut",
          }}
          aria-hidden
        />

        {!reducedMotion ? (
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            {INTRO_SHOWCASE_MOCKS.map(({ id, Mock }, i) => (
              <ShowcaseSquare
                key={id}
                Mock={Mock}
                corner={corners[i]!}
                cardSize={cardSize}
                reducedMotion={false}
                index={i}
              />
            ))}
          </div>
        ) : (
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            {INTRO_SHOWCASE_MOCKS.slice(0, 1).map(({ id, Mock }, i) => (
              <ShowcaseSquare
                key={id}
                Mock={Mock}
                corner={corners[0]!}
                cardSize={cardSize}
                reducedMotion
                index={i}
              />
            ))}
          </div>
        )}

        <motion.div
          className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: brandDelay, duration: 0.2 }}
        >
          <motion.div
            className="vodex-cinematic-intro__icon-wrap relative flex size-24 items-center justify-center"
            initial={{ opacity: 0, scale: 0.35 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              delay: brandDelay,
              duration: 0.55,
              type: "spring",
              stiffness: 260,
              damping: 22,
            }}
          >
            <VodexBrandIcon size="xl" alt="" className="vodex-cinematic-intro__icon relative size-20" />
          </motion.div>

          <div className="mt-5 flex items-center justify-center gap-[0.35em]" aria-hidden>
            {"VODEX".split("").map((ch, i) => (
              <motion.span
                key={ch + i}
                className="vodex-cinematic-intro__letter text-2xl font-semibold tracking-[0.22em] text-white"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: brandDelay + 0.12 + i * 0.05,
                  duration: 0.38,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {ch}
              </motion.span>
            ))}
          </div>
          <motion.p
            className="vodex-cinematic-intro__tagline mt-3 text-[13px] font-medium tracking-wide text-sky-100/85"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
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
