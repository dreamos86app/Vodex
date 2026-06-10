"use client";

import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[1600] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-foreground/30 backdrop-blur-[2px]" aria-label="Close" onClick={onCancel} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={cn(
          "relative w-full max-w-sm overflow-hidden rounded-2xl bg-background p-5 shadow-2xl ring-1",
          destructive ? "ring-destructive/25" : "ring-accent/25",
        )}
      >
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent",
            destructive ? "from-destructive/10" : "from-accent/10",
          )}
        />
        <div className="relative flex items-start gap-3">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl ring-1",
              destructive ? "bg-destructive/10 text-destructive ring-destructive/20" : "bg-accent/10 text-accent ring-accent/20",
            )}
          >
            <AlertTriangle className="size-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-foreground">{title}</p>
            {description ? (
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        <div className="relative mt-5 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={destructive ? "destructive" : "accent"} size="sm" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}
