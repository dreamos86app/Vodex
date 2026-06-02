"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { VodexBrandIcon } from "@/components/brand/vodex-brand-icon";
import { INTRO_SESSION_KEY } from "@/lib/session/session-intro-decision";

const INTRO_MS = 3200;
const LETTERS = "VODEX".split("");

const FLASH_CARDS = [
  { label: "Dashboard", x: -120, y: -40, delay: 0.35 },
  { label: "Charts", x: 100, y: -55, delay: 0.42 },
  { label: "Components", x: -90, y: 50, delay: 0.48 },
  { label: "Launch UI", x: 110, y: 45, delay: 0.54 },
];

function IntroParticles({ reduced }: { reduced: boolean }) {
  const dots = React.useMemo(
    () =>
      Array.from({ length: reduced ? 12 : 28 }, (_, i) => ({
        id: i,
        left: `${8 + ((i * 17) % 84)}%`,
        top: `${12 + ((i * 23) % 76)}%`,
        size: 2 + (i % 3),
        delay: (i % 7) * 0.08,
      })),
    [reduced],
  );
  return (
    <div className="vodex-cinematic-intro__particles pointer-events-none absolute inset-0" aria-hidden>
      {dots.map((d) => (
        <motion.span
          key={d.id}
          className="vodex-cinematic-intro__particle absolute rounded-full bg-indigo-300/80"
          style={{ left: d.left, top: d.top, width: d.size, height: d.size }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 1, 0.4], scale: [0, 1.4, 1] }}
          transition={{ duration: 1.2, delay: d.delay, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

function IntroUiFlashes({ reduced }: { reduced: boolean }) {
  if (reduced) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {FLASH_CARDS.map((card) => (
        <motion.div
          key={card.label}
          className="vodex-cinematic-intro__flash-card absolute left-1/2 top-1/2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-medium text-white/70 backdrop-blur-md"
          initial={{ opacity: 0, x: card.x, y: card.y, scale: 0.6, rotate: -8 }}
          animate={{
            opacity: [0, 0.9, 0],
            x: [card.x, card.x * 0.3, card.x * 1.2],
            y: [card.y, card.y * 0.5, card.y * 1.1],
            scale: [0.6, 1, 0.85],
            rotate: [-8, 4, 12],
          }}
          transition={{ duration: 0.55, delay: card.delay, ease: [0.22, 1, 0.36, 1] }}
        >
          {card.label}
        </motion.div>
      ))}
    </div>
  );
}

export function VodexSessionIntro({
  show,
  onDone,
  onVisible,
}: {
  show: boolean;
  onDone: () => void;
  /** Called once when overlay is actually shown — safe place to mark session seen. */
  onVisible?: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const [phase, setPhase] = React.useState<"hidden" | "enter" | "hold" | "exit">("hidden");
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
    setPhase("enter");
    if (!visibleReported.current) {
      visibleReported.current = true;
      onVisible?.();
    }
    const hold = window.setTimeout(() => setPhase("hold"), 120);
    const exitAt = window.setTimeout(() => setPhase("exit"), INTRO_MS - 480);
    const doneAt = window.setTimeout(finish, INTRO_MS);
    return () => {
      window.clearTimeout(hold);
      window.clearTimeout(exitAt);
      window.clearTimeout(doneAt);
    };
  }, [show, finish, onVisible]);

  if (phase === "hidden") return null;

  const exiting = phase === "exit";

  return (
    <AnimatePresence>
      <motion.div
        className={`vodex-cinematic-intro fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[#030408] ${exiting ? "vodex-cinematic-intro--exit" : ""}`}
        data-testid="vodex-session-intro"
        role="status"
        aria-live="polite"
        aria-label="Loading Vodex"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="vodex-cinematic-intro__bg" aria-hidden />
        <motion.div
          className="vodex-cinematic-intro__nebula"
          aria-hidden
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.4, ease: "easeOut" }}
        />
        <motion.div
          className="vodex-cinematic-intro__rays"
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ delay: 0.5, duration: 1 }}
        />
        <IntroParticles reduced={Boolean(reducedMotion)} />
        <IntroUiFlashes reduced={Boolean(reducedMotion)} />

        <div className="relative z-10 flex flex-col items-center gap-5 px-6 text-center">
          <motion.div
            className="vodex-cinematic-intro__icon-wrap relative flex size-28 items-center justify-center"
            initial={{ opacity: 0, scale: 0.2, filter: "blur(12px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ delay: 0.9, duration: 0.7, type: "spring", stiffness: 180, damping: 18 }}
          >
            <motion.div
              className="absolute inset-0 rounded-full bg-indigo-500/30 blur-2xl"
              animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.85, 0.5] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            />
            <VodexBrandIcon size="xl" alt="" className="vodex-cinematic-intro__icon relative size-20" />
          </motion.div>

          <div className="flex items-center justify-center gap-[0.35em]" aria-hidden>
            {LETTERS.map((ch, i) => (
              <motion.span
                key={ch + i}
                className="vodex-cinematic-intro__letter text-2xl font-semibold tracking-[0.22em] text-white"
                initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{
                  delay: 1.65 + i * 0.07,
                  duration: 0.45,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {ch}
              </motion.span>
            ))}
          </div>
          <motion.p
            className="vodex-cinematic-intro__tagline text-[13px] font-medium tracking-wide text-white/75"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.15, duration: 0.5 }}
          >
            Building intelligent apps
          </motion.p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/** @deprecated use decideSessionIntro in gate */
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
