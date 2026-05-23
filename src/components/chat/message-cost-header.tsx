"use client";

import * as React from "react";
import { Copy, MoreHorizontal, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

export type MessageCostState = "idle" | "pending" | "final" | "finalizing";

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

  if (state === "pending") {
    return (
      <span
        data-testid="message-cost-pending"
        className={cn(
          "inline-flex items-center gap-1 rounded-md bg-surface px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border/70",
          className,
        )}
      >
        <Loader2 className="size-3 animate-spin" />
        Calculating credits…
      </span>
    );
  }

  if (state === "finalizing") {
    return (
      <span
        data-testid="message-cost-finalizing"
        className={cn(
          "text-[10px] font-medium text-muted-foreground",
          className,
        )}
      >
        Cost finalizing… unused credits return automatically.
      </span>
    );
  }

  if (credits != null && credits > 0) {
    return (
      <span
        data-testid="message-cost-final"
        className={cn(
          "rounded-md bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent ring-1 ring-accent/20",
          className,
        )}
      >
        {credits} credits used
      </span>
    );
  }

  return (
    <span className={cn("text-[10px] text-muted-foreground", className)} data-testid="message-cost-zero">
      No charge
    </span>
  );
}

export function MessageActionsMenu({
  messageText,
  className,
}: {
  messageText: string;
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
        <div className="absolute right-0 top-full z-20 mt-1 min-w-[140px] rounded-lg border border-border bg-background py-1 shadow-lg ring-1 ring-border/80">
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
