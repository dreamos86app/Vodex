"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Portal } from "@/components/ui/portal-root";
import { useRegisterOverlay } from "@/components/ui/overlay-provider";
import {
  OVERLAY_DIALOG_BACKDROP_CLASS,
  OVERLAY_DIALOG_PANEL_CLASS,
  overlayZClass,
  type OverlayLayerKey,
} from "@/components/ui/overlay-layers";

type OverlayDialogProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** dialog (default) or confirmation (destructive flows). */
  layer?: Extract<OverlayLayerKey, "dialog" | "confirmation" | "sheet">;
  className?: string;
  panelClassName?: string;
  "data-testid"?: string;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  /** Click backdrop to close (default true). */
  closeOnBackdrop?: boolean;
};

function trapFocus(container: HTMLElement, e: KeyboardEvent) {
  if (e.key !== "Tab") return;
  const focusable = container.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
  );
  if (focusable.length === 0) return;
  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

export function OverlayDialog({
  open,
  onClose,
  children,
  layer = "dialog",
  className,
  panelClassName,
  "data-testid": testId,
  returnFocusRef,
  closeOnBackdrop = true,
}: OverlayDialogProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);

  useRegisterOverlay({
    open,
    layer,
    onEscape: onClose,
    lockScroll: true,
    returnFocusRef,
  });

  React.useEffect(() => {
    if (!open || !panelRef.current) return;
    const panel = panelRef.current;
    const t = window.setTimeout(() => {
      const auto = panel.querySelector<HTMLElement>(
        'input, button, textarea, [href], [tabindex]:not([tabindex="-1"])',
      );
      auto?.focus();
    }, 0);
    const onKey = (e: KeyboardEvent) => trapFocus(panel, e);
    panel.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      panel.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <Portal layer={layer}>
      <AnimatePresence>
        {open ? (
          <div
            className={cn(
              "fixed inset-0 flex items-center justify-center p-4",
              overlayZClass(layer === "confirmation" ? "confirmation" : layer === "sheet" ? "sheet" : "dialog"),
              className,
            )}
            role="presentation"
          >
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={cn(OVERLAY_DIALOG_BACKDROP_CLASS, "absolute inset-0")}
              aria-label="Close dialog"
              onClick={closeOnBackdrop ? onClose : undefined}
            />
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18 }}
              className={cn(
                "relative z-[1] w-full max-w-md",
                OVERLAY_DIALOG_PANEL_CLASS,
                panelClassName,
              )}
              data-testid={testId}
              onClick={(e) => e.stopPropagation()}
            >
              {children}
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </Portal>
  );
}
