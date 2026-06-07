"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Portal } from "@/components/ui/portal-root";
import { useRegisterOverlay } from "@/components/ui/overlay-provider";
import { useFloatingPosition } from "@/hooks/use-floating-position";
import {
  OVERLAY_MENU_SCRIM_CLASS,
  OVERLAY_MENU_SOLID_SURFACE_CLASS,
  OVERLAY_MENU_SURFACE_CLASS,
  overlayZClass,
  type OverlayLayerKey,
} from "@/components/ui/overlay-layers";

type FloatingMenuProps = {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  width?: number;
  className?: string;
  "data-testid"?: string;
  layer?: Extract<OverlayLayerKey, "dropdown" | "popover" | "contextMenu">;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  /** Full-page blur scrim — only the menu stays sharp and readable. */
  scrim?: boolean;
};

export function FloatingMenu({
  open,
  onClose,
  anchorRef,
  children,
  width = 220,
  className,
  "data-testid": testId,
  layer = "popover",
  returnFocusRef,
  scrim = false,
}: FloatingMenuProps) {
  const menuRef = React.useRef<HTMLDivElement>(null);
  const pos = useFloatingPosition({ anchorRef, open, width, align: "end" });

  useRegisterOverlay({
    open,
    layer: scrim ? "dialog" : layer,
    onEscape: onClose,
    lockScroll: scrim,
    returnFocusRef,
  });

  React.useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!scrim && anchorRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      onClose();
    };
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, [open, onClose, anchorRef, scrim]);

  const menuLayer = scrim ? "dialog" : layer;
  const surfaceClass = scrim ? OVERLAY_MENU_SOLID_SURFACE_CLASS : OVERLAY_MENU_SURFACE_CLASS;

  return (
    <Portal layer={scrim ? "dialog+scrim" : layer}>
      <AnimatePresence>
        {open && (scrim || pos) ? (
          <>
            {scrim ? (
              <motion.button
                type="button"
                aria-label="Close menu"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                className={cn(OVERLAY_MENU_SCRIM_CLASS, overlayZClass("dialogBackdrop"))}
                onClick={onClose}
              />
            ) : null}
            <motion.div
              ref={menuRef}
              role="menu"
              initial={{ opacity: 0, y: scrim ? 8 : pos!.placement.startsWith("top") ? 4 : -4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: scrim ? 8 : pos!.placement.startsWith("top") ? 4 : -4, scale: 0.96 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              style={
                scrim
                  ? { width: Math.max(width, 260), maxWidth: "min(92vw, 320px)" }
                  : { top: pos!.top, left: pos!.left, width }
              }
              className={cn(
                "fixed",
                overlayZClass(menuLayer),
                surfaceClass,
                scrim && "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
                className,
              )}
              data-testid={testId}
              onClick={(e) => e.stopPropagation()}
            >
              {children}
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </Portal>
  );
}
