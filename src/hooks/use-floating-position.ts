"use client";

import * as React from "react";

export type FloatingPlacement = "bottom-start" | "bottom-end" | "top-start" | "top-end";

export type FloatingPosition = {
  top: number;
  left: number;
  placement: FloatingPlacement;
};

type Options = {
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  width: number;
  height?: number;
  offset?: number;
  preferred?: "bottom" | "top";
  align?: "start" | "end";
};

const VIEWPORT_PAD = 8;

/**
 * Viewport-aware floating position with flip (up/down) and shift (left/right).
 */
export function useFloatingPosition({
  anchorRef,
  open,
  width,
  height = 280,
  offset = 6,
  preferred = "bottom",
  align = "end",
}: Options): FloatingPosition | null {
  const [pos, setPos] = React.useState<FloatingPosition | null>(null);

  React.useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setPos(null);
      return;
    }

    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const r = anchor.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let placement: FloatingPlacement =
        preferred === "bottom"
          ? align === "end"
            ? "bottom-end"
            : "bottom-start"
          : align === "end"
            ? "top-end"
            : "top-start";

      let top =
        preferred === "bottom" ? r.bottom + offset : r.top - offset - height;
      let left = align === "end" ? r.right - width : r.left;

      const fitsBelow = r.bottom + offset + height <= vh - VIEWPORT_PAD;
      const fitsAbove = r.top - offset - height >= VIEWPORT_PAD;

      if (preferred === "bottom" && !fitsBelow && fitsAbove) {
        placement = align === "end" ? "top-end" : "top-start";
        top = r.top - offset - height;
      } else if (preferred === "top" && !fitsAbove && fitsBelow) {
        placement = align === "end" ? "bottom-end" : "bottom-start";
        top = r.bottom + offset;
      }

      if (left + width > vw - VIEWPORT_PAD) {
        left = vw - width - VIEWPORT_PAD;
      }
      if (left < VIEWPORT_PAD) left = VIEWPORT_PAD;

      if (top + height > vh - VIEWPORT_PAD) {
        top = Math.max(VIEWPORT_PAD, vh - height - VIEWPORT_PAD);
      }
      if (top < VIEWPORT_PAD) top = VIEWPORT_PAD;

      setPos({ top, left, placement });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchorRef, width, height, offset, preferred, align]);

  return pos;
}
