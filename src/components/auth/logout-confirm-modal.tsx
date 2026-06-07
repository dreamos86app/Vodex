"use client";

import * as React from "react";
import { LogOut, X, Loader2, Sparkles } from "lucide-react";
import { runFullSignOut } from "@/lib/auth/sign-out-client";
import { OverlayDialog } from "@/components/ui/overlay-dialog";

interface LogoutConfirmModalProps {
  open: boolean;
  onClose: () => void;
}

export function LogoutConfirmModal({ open, onClose }: LogoutConfirmModalProps) {
  const [loading, setLoading] = React.useState(false);

  async function confirmLogout() {
    setLoading(true);
    try {
      await runFullSignOut();
    } finally {
      setLoading(false);
    }
  }

  return (
    <OverlayDialog
      open={open}
      onClose={loading ? () => undefined : onClose}
      layer="confirmation"
      closeOnBackdrop={!loading}
      data-testid="logout-confirm-modal"
      panelClassName="vodex-logout-modal-card max-w-[23rem] ring-sky-200/60 dark:ring-sky-500/25"
    >
      <div className="vodex-logout-modal-card__glow pointer-events-none absolute inset-0" aria-hidden />
      <div className="h-1 w-full bg-gradient-to-r from-sky-400 via-violet-500 to-cyan-400" />

      <div className="relative px-6 pb-6 pt-5">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-surface hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" strokeWidth={1.75} />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/15 to-violet-500/15 ring-1 ring-sky-300/50 dark:from-sky-400/20 dark:to-violet-500/20 dark:ring-sky-500/30">
            <LogOut className="size-7 text-sky-600 dark:text-sky-300" strokeWidth={1.65} />
          </div>
          <h2 className="mt-4 text-[17px] font-bold tracking-tight text-foreground">
            Sign out of Vodex?
          </h2>
          <p className="mt-2 max-w-[16rem] text-[13px] leading-relaxed text-muted-foreground">
            You&apos;ll return to the sign-in screen. Unsaved drafts in open tabs may be lost.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-xl bg-surface py-3 text-[13px] font-semibold text-foreground ring-1 ring-border transition hover:bg-surface-raised disabled:opacity-50"
          >
            Stay signed in
          </button>
          <button
            type="button"
            onClick={confirmLogout}
            disabled={loading}
            className="vodex-logout-modal-card__cta flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-bold text-white disabled:opacity-70"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Signing out…
              </>
            ) : (
              <>
                <Sparkles className="size-3.5 opacity-90" />
                Log out
              </>
            )}
          </button>
        </div>
      </div>
    </OverlayDialog>
  );
}
