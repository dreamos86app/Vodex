"use client";

import { cn } from "@/lib/utils";
import { Check, Loader2, Circle } from "lucide-react";

export type TimelineStage = {
  id: string;
  label: string;
  state: "done" | "active" | "pending" | "error";
};

export function CreateProgressTimeline({ stages }: { stages: TimelineStage[] }) {
  if (!stages.length) return null;
  return (
    <ol className="space-y-2">
      {stages.map((s, i) => (
        <li key={s.id} className="flex items-center gap-3">
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full ring-1",
              s.state === "done" && "bg-positive/15 text-positive ring-positive/30",
              s.state === "active" && "bg-accent/15 text-accent ring-accent/30",
              s.state === "error" && "bg-destructive/15 text-destructive ring-destructive/30",
              s.state === "pending" && "bg-surface text-muted-foreground ring-border",
            )}
          >
            {s.state === "done" ? (
              <Check className="size-3.5" strokeWidth={2} />
            ) : s.state === "active" ? (
              <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />
            ) : (
              <Circle className="size-3" strokeWidth={1.5} />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className={cn("text-[12.5px] font-medium", s.state === "pending" ? "text-muted-foreground" : "text-foreground")}>
              {s.label}
            </p>
          </div>
          {i < stages.length - 1 && <span className="sr-only">then</span>}
        </li>
      ))}
    </ol>
  );
}
