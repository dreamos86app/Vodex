"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, X, Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
};

export function ChatDeleteConfirmModal({ open, title, onClose, onConfirm }: Props) {
  const [loading, setLoading] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose, loading]);

  async function confirm() {
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[99998] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
          onClick={loading ? undefined : onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            className="relative w-full max-w-[22rem] overflow-hidden rounded-2xl bg-background shadow-2xl ring-1 ring-border"
            onClick={(e) => e.stopPropagation()}
            data-testid="chat-delete-confirm-modal"
          >
            <div className="h-1 w-full bg-gradient-to-r from-rose-400 via-red-500 to-orange-400" />
            <div className="relative px-5 pb-5 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
              <div className="flex flex-col items-center text-center">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-rose-500/10 ring-1 ring-rose-500/25">
                  <Trash2 className="size-5 text-rose-600" strokeWidth={1.75} />
                </div>
                <h2 className="mt-3 text-[16px] font-bold text-foreground">Delete this chat?</h2>
                <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
                  <span className="font-medium text-foreground">{title}</span> will be removed from your
                  list. Messages cannot be recovered.
                </p>
              </div>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 rounded-xl bg-surface py-2.5 text-[13px] font-semibold ring-1 ring-border"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void confirm()}
                  disabled={loading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 py-2.5 text-[13px] font-bold text-white"
                >
                  {loading ? <Loader2 className="size-4 animate-spin" /> : "Delete chat"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
