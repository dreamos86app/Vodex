"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Copy, MessageSquare, X, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import type { PreviewBlockingIssue } from "@/components/preview/preview-error-gate";

export type { PreviewBlockingIssue };

export function PreviewBlockedPopup({
  issue,
  repairPrompt,
  onFixInChat,
  onDismiss,
  className,
  variant = "runtime",
}: {
  issue: PreviewBlockingIssue;
  repairPrompt: string;
  onFixInChat: (autoSend: boolean) => void;
  onDismiss?: () => void;
  className?: string;
  variant?: "runtime" | "iframe";
}) {
  const headline = variant === "iframe" ? "Preview embed blocked" : "Preview needs repair";
  const [open, setOpen] = React.useState(false);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(repairPrompt);
      toast.success("Repair prompt copied — paste in chat when ready");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  return (
    <div className={cn("pointer-events-none absolute bottom-3 right-3 z-10 flex flex-col items-end gap-2", className)}>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto w-[min(92vw,380px)] overflow-hidden rounded-2xl bg-background/95 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.35)] ring-1 ring-red-500/25 backdrop-blur-md"
          >
            <div className="flex items-start gap-2 border-b border-border/60 px-3.5 py-3">
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10 ring-1 ring-red-500/20">
                <AlertTriangle className="size-4 text-red-500" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-500/90">{headline}</p>
                <p className="mt-0.5 text-[13px] font-semibold leading-snug text-foreground">{issue.title}</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{issue.summary}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <div className="max-h-44 overflow-y-auto px-3.5 py-2.5 scrollbar-thin">
              {issue.details ? (
                <pre className="whitespace-pre-wrap font-mono text-[10.5px] leading-relaxed text-muted-foreground">
                  {issue.details}
                </pre>
              ) : null}
              {issue.fixHint ? (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">Fix: </span>
                  {issue.fixHint}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-1.5 border-t border-border/60 bg-muted/20 px-3 py-2.5">
              <button
                type="button"
                onClick={() => onFixInChat(true)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-[11.5px] font-semibold text-white hover:bg-accent/90"
              >
                <MessageSquare className="size-3.5" />
                Fix in chat
              </button>
              <button
                type="button"
                onClick={() => void copyPrompt()}
                className="inline-flex items-center gap-1 rounded-xl bg-surface px-2.5 py-2 text-[11px] font-semibold text-foreground ring-1 ring-border hover:bg-surface-raised"
              >
                <Copy className="size-3.5" />
                Copy
              </button>
              {onDismiss ? (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="rounded-xl px-2.5 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                >
                  Show preview
                </button>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "pointer-events-auto inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[11.5px] font-semibold shadow-lg ring-1 transition",
          open
            ? "bg-background text-foreground ring-border"
            : "bg-red-500 text-white ring-red-600/30 hover:bg-red-600",
        )}
        aria-expanded={open}
      >
        <AlertTriangle className="size-3.5 shrink-0" strokeWidth={1.75} />
        Preview blocked
        <ChevronUp className={cn("size-3.5 transition", open && "rotate-180")} />
      </motion.button>
    </div>
  );
}
