"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { VodexBrandIcon } from "@/components/brand/vodex-brand-icon";
import { INTRO_SESSION_KEY } from "@/lib/session/session-intro-decision";

const INTRO_MS = 3600;

const SHOWCASE_APPS = [
  {
    id: "fashion",
    label: "Clothing store",
    gradient: "from-rose-500 via-fuchsia-500 to-violet-600",
    chips: ["New drops", "Cart", "Lookbook"],
  },
  {
    id: "food",
    label: "Food delivery",
    gradient: "from-orange-500 via-amber-500 to-yellow-400",
    chips: ["Live map", "Orders", "Promos"],
  },
  {
    id: "video",
    label: "AI video editor",
    gradient: "from-cyan-500 via-blue-500 to-indigo-600",
    chips: ["Timeline", "Effects", "Export"],
  },
  {
    id: "finance",
    label: "Finance app",
    gradient: "from-emerald-500 via-teal-500 to-cyan-600",
    chips: ["Portfolio", "Spend", "Goals"],
  },
] as const;

function ShowcaseCard({
  app,
  layout,
  delay,
  position,
}: {
  app: (typeof SHOWCASE_APPS)[number];
  layout: "desktop" | "mobile";
  delay: number;
  position: { x: number; y: number; rotate: number; scale: number };
}) {
  const isMobile = layout === "mobile";
  return (
    <motion.div
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      initial={{ opacity: 0, scale: 0.5, rotate: position.rotate - 12, filter: "blur(10px)" }}
      animate={{
        opacity: [0, 1, 1, 0],
        scale: [0.5, position.scale, position.scale * 0.92, 0.2],
        rotate: [position.rotate - 12, position.rotate, position.rotate + 6, position.rotate + 20],
        x: [position.x, position.x * 0.35, 0],
        y: [position.y, position.y * 0.4, 0],
      }}
      transition={{ duration: 1.35, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <div
        className={`overflow-hidden rounded-2xl bg-gradient-to-br ${app.gradient} shadow-[0_20px_60px_-20px_rgba(0,0,0,0.65)] ring-1 ring-white/20 ${
          isMobile ? "h-[220px] w-[110px]" : "h-[148px] w-[248px]"
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/15 px-2.5 py-1.5">
          <span className="text-[9px] font-semibold text-white/90">{app.label}</span>
          <span className="size-1.5 rounded-full bg-white/80" />
        </div>
        <div className="space-y-1.5 p-2.5">
          <div className="h-8 rounded-lg bg-white/15" />
          <div className="grid grid-cols-3 gap-1">
            {app.chips.map((c) => (
              <div key={c} className="rounded-md bg-black/15 px-1 py-1 text-center text-[7px] text-white/85">
                {c}
              </div>
            ))}
          </div>
          <div className="h-12 rounded-lg bg-white/10" />
        </div>
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
    const exitAt = window.setTimeout(() => setPhase("exit"), INTRO_MS - 520);
    const doneAt = window.setTimeout(finish, INTRO_MS);
    return () => {
      window.clearTimeout(exitAt);
      window.clearTimeout(doneAt);
    };
  }, [show, finish, onVisible]);

  if (phase === "hidden") return null;

  const exiting = phase === "exit";
  const layout =
    typeof window !== "undefined" && window.innerWidth < 768 ? "mobile" : "desktop";

  const positions =
    layout === "mobile"
      ? [
          { x: -70, y: -90, rotate: -8, scale: 1 },
          { x: 72, y: -70, rotate: 10, scale: 0.95 },
          { x: -64, y: 72, rotate: 6, scale: 0.92 },
          { x: 70, y: 88, rotate: -10, scale: 0.9 },
        ]
      : [
          { x: -280, y: -40, rotate: -10, scale: 1 },
          { x: -90, y: -110, rotate: 6, scale: 0.95 },
          { x: 120, y: -95, rotate: -8, scale: 0.96 },
          { x: 290, y: -20, rotate: 12, scale: 1 },
        ];

  return (
    <AnimatePresence>
      <motion.div
        className={`vodex-cinematic-intro vodex-intro-v2 fixed inset-0 z-[9999] overflow-hidden bg-[#02040a] ${exiting ? "vodex-cinematic-intro--exit" : ""}`}
        data-testid="vodex-session-intro"
        role="status"
        aria-live="polite"
        aria-label="Loading Vodex"
        initial={{ opacity: 1 }}
        animate={{ opacity: exiting ? 0 : 1 }}
        transition={{ duration: 0.45 }}
      >
        <div className="vodex-cinematic-intro__bg" aria-hidden />
        <motion.div
          className="vodex-cinematic-intro__nebula"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          aria-hidden
        />
        <motion.div
          className="vodex-cinematic-intro__rays"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.55 }}
          transition={{ delay: 0.25, duration: 0.6 }}
          aria-hidden
        />

        {!reducedMotion ? (
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            {SHOWCASE_APPS.map((app, i) => (
              <ShowcaseCard
                key={app.id}
                app={app}
                layout={layout}
                delay={0.32 + i * 0.14}
                position={positions[i]!}
              />
            ))}
            <motion.div
              className="absolute left-1/2 top-1/2 size-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-500/25 blur-3xl"
              initial={{ opacity: 0, scale: 0.2 }}
              animate={{ opacity: [0, 0.9, 0.5], scale: [0.2, 1.4, 1.8] }}
              transition={{ delay: 1.55, duration: 0.9 }}
            />
          </div>
        ) : null}

        <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
          <motion.div
            className="vodex-cinematic-intro__icon-wrap relative flex size-24 items-center justify-center"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: reducedMotion ? 0.1 : 1.85, duration: 0.55, type: "spring" }}
          >
            <VodexBrandIcon size="xl" alt="" className="vodex-cinematic-intro__icon relative size-20" />
          </motion.div>

          <div className="mt-5 flex items-center justify-center gap-[0.35em]" aria-hidden>
            {"VODEX".split("").map((ch, i) => (
              <motion.span
                key={ch + i}
                className="vodex-cinematic-intro__letter text-2xl font-semibold tracking-[0.22em] text-white"
                initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ delay: (reducedMotion ? 0.2 : 2.1) + i * 0.06, duration: 0.4 }}
              >
                {ch}
              </motion.span>
            ))}
          </div>
          <motion.p
            className="vodex-cinematic-intro__tagline mt-3 text-[13px] font-medium tracking-wide text-white/75"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reducedMotion ? 0.35 : 2.45, duration: 0.45 }}
          >
            Preparing your workspace
          </motion.p>
        </div>
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
