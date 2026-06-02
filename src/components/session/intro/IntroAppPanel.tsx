"use client";

import * as React from "react";
import { motion } from "framer-motion";
import type { IntroAppConfig } from "@/components/session/intro/intro-apps";
import type { IntroScreenLayout } from "@/components/session/intro-v3-app-screens";
import { IntroAliveOverlay } from "@/components/session/intro/IntroAliveOverlay";
import { COLLAPSE_EASE, PREMIUM_EASE, SHOWCASE_END_S } from "@/components/session/intro/intro-constants";

export function IntroAppPanel({
  app,
  layout,
  timeline,
  reducedMotion,
}: {
  app: IntroAppConfig;
  layout: IntroScreenLayout;
  timeline: number;
  reducedMotion: boolean;
}) {
  const corner = layout === "mobile" ? app.mobile : app.desktop;
  const frameClass =
    layout === "mobile"
      ? "h-[min(44vh,400px)] w-[min(48vw,220px)]"
      : "h-[min(44vh,380px)] w-[min(44vw,440px)]";

  const entered = timeline >= app.enterAt;
  const collapsing = timeline >= SHOWCASE_END_S;
  const floatY = entered && !collapsing ? Math.sin(timeline * 1.4 + app.enterAt) * 4 : 0;

  const Screen = app.Screen;

  if (reducedMotion) {
    if (!entered || timeline >= SHOWCASE_END_S + 0.2) return null;
    return (
      <div
        className={`vodex-intro-v3__screen absolute left-1/2 top-1/2 z-[6] -translate-x-1/2 -translate-y-1/2 opacity-90 ${frameClass}`}
        style={{
          transform: `translate(calc(-50% + ${corner.x}), calc(-50% + ${corner.y}))`,
        }}
      >
        <Screen layout={layout} />
      </div>
    );
  }

  return (
    <motion.div
      className={`vodex-intro-v3__screen vodex-intro-p13__panel absolute left-1/2 top-1/2 z-[6] -translate-x-1/2 -translate-y-1/2 ${frameClass}`}
      data-intro-app-panel={app.id}
      initial={false}
      animate={
        collapsing
          ? {
              opacity: [1, 0.85, 0],
              scale: [corner.scale, corner.scale * 0.88, 0.08],
              x: [corner.x, "0%", "0%"],
              y: [corner.y, "0%", "0%"],
              rotate: [corner.rotate, corner.rotate * 2.5, 0],
              filter: ["blur(0px)", "blur(1px)", "blur(14px)"],
            }
          : entered
            ? {
                opacity: 1,
                scale: corner.scale,
                x: corner.x,
                y: `calc(${corner.y} + ${floatY}px)`,
                rotate: corner.rotate,
                filter: "blur(0px)",
              }
            : {
                opacity: 0,
                scale: corner.scale * 0.88,
                x: app.entrance.fromX,
                y: app.entrance.fromY,
                rotate: app.entrance.fromRotate,
                filter: "blur(8px)",
              }
      }
      transition={
        collapsing
          ? { duration: 0.6, ease: COLLAPSE_EASE }
          : entered
            ? { duration: 0.85, ease: PREMIUM_EASE }
            : { duration: 0.01 }
      }
      style={{
        zIndex: corner.z,
        perspective: 1400,
        transformStyle: "preserve-3d",
        willChange: "transform, opacity, filter",
      }}
    >
      <div
        className={`vodex-intro-p13__glow-trail vodex-intro-p13__glow-trail--${app.entrance.glow}`}
        aria-hidden
      />
      <div className="vodex-intro-v3__chromatic vodex-intro-p13__chromatic relative h-full w-full shadow-[0_32px_90px_-20px_rgba(0,0,0,0.88)]">
        <Screen layout={layout} />
        <IntroAliveOverlay accent={app.accent} />
      </div>
    </motion.div>
  );
}
