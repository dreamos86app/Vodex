"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { CreationMode } from "@/lib/creation/models";
import { VodexBrandIcon } from "@/components/brand/vodex-brand-icon";
import {
  MessageActionsMenu,
  MessageCostBadge,
  type MessageCostState,
} from "@/components/chat/message-cost-header";

const MODE_LABEL: Record<CreationMode, string> = {
  discuss: "Discuss",
  edit: "Edit",
  build: "Build",
};

export function DreamOSMessageShell({
  mode,
  children,
  className,
  status,
  costState,
  creditsUsed,
  messageTextForCopy,
}: {
  mode: CreationMode;
  children: React.ReactNode;
  className?: string;
  status?: "thinking" | "done" | "error" | null;
  costState?: MessageCostState;
  creditsUsed?: number | null;
  messageTextForCopy?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-start gap-2">
        <div className="flex size-8 shrink-0 items-center justify-center">
          <VodexBrandIcon variant="assistant" alt="" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-semibold text-foreground">Vodex</span>
            <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent">
              {MODE_LABEL[mode]}
            </span>
            {status === "thinking" && (
              <span className="text-[10px] text-muted-foreground">Thinking…</span>
            )}
            {status === "done" && (
              <span className="text-[10px] text-positive">Done</span>
            )}
            {status === "error" && (
              <span className="text-[10px] text-destructive">Error</span>
            )}
            <div className="ml-auto flex items-center gap-1.5">
              <MessageCostBadge state={costState ?? "idle"} credits={creditsUsed ?? null} />
              {messageTextForCopy && (
                <MessageActionsMenu
                  messageText={messageTextForCopy}
                  credits={creditsUsed}
                  creditsPending={costState === "pending" || costState === "finalizing"}
                />
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="pl-9">{children}</div>
    </div>
  );
}
