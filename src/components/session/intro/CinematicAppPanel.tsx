"use client";

import * as React from "react";
import { motion } from "framer-motion";
import type { IntroAppConfig } from "@/components/session/intro/intro-apps";
import { IntroAliveOverlay } from "@/components/session/intro/IntroAliveOverlay";
import { IntroReferenceImage } from "@/components/session/intro/IntroReferenceImage";
import { COLLAPSE_EASE, PREMIUM_EASE, SHOWCASE_END_S } from "@/components/session/intro/intro-constants";

function CinematicAppPanelInner({
  app,
  layout,
  timeline,
  reducedMotion,
}: {
  app: IntroAppConfig;
  layout: "desktop" | "mobile";
  timeline: number;
  reducedMotion: boolean;
}) {
  const corner = layout === "mobile" ? app.mobile : app.desktop;
  const frameClass =
    layout === "mobile"
      ? "h-[min(40vh,360px)] w-[min(46vw,212px)]"
      : "h-[min(44vh,420px)] w-[min(40vw,500px)]";

  const entered = timeline >= app.enterAt;
  const collapsing = timeline >= SHOWCASE_END_S;
  const floatY = entered && !collapsing ? Math.sin(timeline * 1.35 + app.enterAt) * 6 : 0;
  const floatRotate =
    entered && !collapsing ? Math.sin(timeline * 0.9 + app.enterAt * 1.6) * 3.5 : 0;
  const liveRotate = corner.rotate + floatRotate;

  const panel = (
    <div className="vodex-intro-p13__image-panel relative h-full w-full overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ring-sky-300/25">
      <IntroReferenceImage
        src={app.imageSrc}
        alt={app.imageAlt}
        layout={layout}
        panelId={app.id}
      />
      <IntroAliveOverlay accent={app.accent} />
      <div className="vodex-intro-p13__glass-sheen pointer-events-none absolute inset-0" aria-hidden />
    </div>
  );

  if (reducedMotion) {
    if (!entered || timeline >= SHOWCASE_END_S + 0.25) return null;
    return (
      <div
        className={`vodex-intro-v3__screen vodex-intro-p13__panel absolute left-1/2 top-1/2 z-[6] -translate-x-1/2 -translate-y-1/2 ${frameClass}`}
        data-intro-app-panel={app.id}
        style={{
          transform: `translate3d(calc(-50% + ${corner.x}), calc(-50% + ${corner.y}), 0) scale(${corner.scale}) rotate(${corner.rotate}deg)`,
          zIndex: corner.z,
        }}
      >
        {panel}
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
              scale: [corner.scale, corner.scale * 0.86, 0.06],
              x: [corner.x, "0vw", "0vw"],
              y: [corner.y, "0vh", "0vh"],
              rotate: [liveRotate, liveRotate * 0.4, 0],
            }
          : entered
            ? {
                opacity: 1,
                scale: corner.scale,
                x: corner.x,
                y: `calc(${corner.y} + ${floatY}px)`,
                rotate: liveRotate,
              }
            : {
                opacity: 0,
                scale: corner.scale * 0.88,
                x: app.entrance.fromX,
                y: app.entrance.fromY,
                rotate: app.entrance.fromRotate,
              }
      }
      transition={
        collapsing
          ? { duration: 0.65, ease: COLLAPSE_EASE }
          : entered
            ? { duration: 0.95, ease: PREMIUM_EASE }
            : { duration: 0.01 }
      }
      style={{
        zIndex: corner.z,
        willChange: "transform, opacity",
      }}
    >
      <div
        className={`vodex-intro-p13__glow-trail vodex-intro-p13__glow-trail--${app.entrance.glow}`}
        aria-hidden
      />
      <div className="vodex-intro-v3__chromatic vodex-intro-p13__chromatic relative h-full w-full">
        {panel}
      </div>
    </motion.div>
  );
}

export const CinematicAppPanel = React.memo(CinematicAppPanelInner);
