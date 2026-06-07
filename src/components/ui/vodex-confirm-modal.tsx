"use client";

import * as React from "react";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { OverlayDialog } from "@/components/ui/overlay-dialog";

type Props = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
};

export function VodexConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
  onConfirm,
  onCancel,
  returnFocusRef,
}: Props) {
  return (
    <OverlayDialog
      open={open}
      onClose={onCancel}
      layer="confirmation"
      returnFocusRef={returnFocusRef}
      data-testid="vodex-confirm-modal"
      panelClassName="max-w-md"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <p className="text-[15px] font-semibold text-foreground">{title}</p>
          {description ? (
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <button type="button" onClick={onCancel} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
          <X className="size-4" />
        </button>
      </div>
      <div className="flex flex-wrap justify-end gap-2 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="rounded-xl px-4 py-2.5 text-[12px] font-semibold text-muted-foreground ring-1 ring-border hover:bg-surface"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void onConfirm()}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[12px] font-semibold text-white disabled:opacity-60",
            variant === "destructive" ? "bg-destructive" : "bg-accent",
          )}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : null}
          {confirmLabel}
        </button>
      </div>
    </OverlayDialog>
  );
}
