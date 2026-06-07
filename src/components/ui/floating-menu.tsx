"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Portal } from "@/components/ui/portal-root";
import { useRegisterOverlay } from "@/components/ui/overlay-provider";
import { useFloatingPosition } from "@/hooks/use-floating-position";
import {
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
}: FloatingMenuProps) {
  const menuRef = React.useRef<HTMLDivElement>(null);
  const pos = useFloatingPosition({ anchorRef, open, width, align: "end" });

  useRegisterOverlay({
    open,
    layer,
    onEscape: onClose,
    lockScroll: false,
    returnFocusRef,
  });

  React.useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      onClose();
    };
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, [open, onClose, anchorRef]);

  return (
    <Portal layer={layer}>
      <AnimatePresence>
        {open && pos ? (
          <motion.div
            ref={menuRef}
            role="menu"
            initial={{ opacity: 0, y: pos.placement.startsWith("top") ? 4 : -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: pos.placement.startsWith("top") ? 4 : -4, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            style={{ top: pos.top, left: pos.left, width }}
            className={cn(
              "fixed",
              overlayZClass(layer),
              OVERLAY_MENU_SURFACE_CLASS,
              className,
            )}
            data-testid={testId}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Portal>
  );
}
