"use client";

import * as React from "react";
import { Trash2, Loader2 } from "lucide-react";
import { OverlayDialog } from "@/components/ui/overlay-dialog";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export function ChatDeleteConfirmModal({ open, title, onClose, onConfirm }: Props) {
  const [loading, setLoading] = React.useState(false);

  async function confirm() {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <OverlayDialog
      open={open}
      onClose={() => {
        if (!loading) onClose();
      }}
      layer="confirmation"
      closeOnBackdrop={!loading}
      data-testid="chat-delete-confirm-modal"
      panelClassName="max-w-[22rem]"
    >
      <div className="flex items-start gap-3 border-b border-border px-4 py-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
          <Trash2 className="size-4 text-destructive" />
        </div>
        <div>
          <p className="text-[14px] font-semibold text-foreground">Delete conversation?</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">{title}</p>
        </div>
      </div>
      <div className="flex justify-end gap-2 px-4 py-3">
        <button
          type="button"
          disabled={loading}
          onClick={onClose}
          className="rounded-lg px-3 py-1.5 text-[12px] font-medium ring-1 ring-border"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void confirm()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-[12px] font-semibold text-white"
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Delete
        </button>
      </div>
    </OverlayDialog>
  );
}
