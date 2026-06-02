"use client";

import * as React from "react";
import { Copy, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

export type MessageCostState = "idle" | "pending" | "final" | "finalizing";

function formatCredits(credits: number): string {
  if (!Number.isFinite(credits)) return "—";
  if (credits >= 10) return credits.toFixed(1).replace(/\.0$/, "");
  if (credits >= 1) return credits.toFixed(1);
  if (credits > 0) return credits.toFixed(2);
  return "0";
}

export function MessageActionsMenu({
  messageText,
  credits,
  creditsPending,
  className,
}: {
  messageText: string;
  credits?: number | null;
  creditsPending?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      toast.success("Message copied");
      setOpen(false);
    } catch {
      toast.error("Could not copy");
    }
  };

  const showCredits =
    creditsPending || (typeof credits === "number" && credits >= 0);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        data-testid="message-actions-menu"
        aria-label="Message actions"
        onClick={() => setOpen((v) => !v)}
        className="rounded-md p-1 text-muted-foreground transition hover:bg-surface hover:text-foreground"
      >
        <MoreHorizontal className="size-4" strokeWidth={1.75} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 min-w-[168px] rounded-lg border border-border bg-background py-1 shadow-lg ring-1 ring-border/80">
          {showCredits ? (
            <div
              className="border-b border-border/60 px-3 py-2 text-[11px]"
              data-testid="message-action-credits"
            >
              <span className="text-muted-foreground">Credits used</span>
              <p className="mt-0.5 font-semibold tabular-nums text-foreground">
                {creditsPending ? (
                  <span className="text-muted-foreground">Calculating…</span>
                ) : (
                  formatCredits(credits ?? 0)
                )}
              </p>
            </div>
          ) : null}
          <button
            type="button"
            data-testid="message-action-copy"
            onClick={() => void copy()}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-foreground hover:bg-surface"
          >
            <Copy className="size-3.5" />
            Copy message
          </button>
        </div>
      )}
    </div>
  );
}

export function MessageCostBadge({
  state,
  credits,
  className,
}: {
  state: MessageCostState;
  credits: number | null;
  className?: string;
}) {
  if (state === "idle") return null;
  const label =
    state === "pending" || state === "finalizing"
      ? "…"
      : typeof credits === "number"
        ? formatCredits(credits)
        : "—";
  return (
    <span
      className={cn(
        "rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground",
        className,
      )}
      data-testid="message-cost-badge"
    >
      {label}c
    </span>
  );
}
