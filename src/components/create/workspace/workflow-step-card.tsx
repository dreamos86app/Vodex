"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type WorkflowStepCardStatus = "pending" | "active" | "completed" | "failed";

function WorkingDots() {
  const [dots, setDots] = React.useState(1);
  React.useEffect(() => {
    const id = setInterval(() => setDots((d) => (d >= 3 ? 1 : d + 1)), 420);
    return () => clearInterval(id);
  }, []);
  return (
    <p className="mt-1 text-[10px] text-muted-foreground">
      Working{"".repeat(dots)}
      <span className="inline-block w-2" />
    </p>
  );
}

export type WorkflowStepCardProps = {
  status: WorkflowStepCardStatus;
  label: string;
  sublabel?: string;
  progress?: number;
  fileDelta?: { added?: number; removed?: number };
  startedAt?: string;
  completedAt?: string;
  error?: string;
  onErrorClick?: () => void;
  className?: string;
};

export function WorkflowStepCard({
  status,
  label,
  sublabel,
  progress,
  fileDelta,
  error,
  onErrorClick,
  className,
}: WorkflowStepCardProps) {
  const active = status === "active";
  const completed = status === "completed";
  const failed = status === "failed";

  return (
    <div
      className={cn(
        "mr-6 max-w-md rounded-xl px-3 py-2 text-[11px] transition-all sm:mr-10",
        active && "workflow-gold-border-active workflow-active-ring bg-amber-500/[0.07]",
        completed && "border border-transparent opacity-80",
        failed && "border border-destructive/45 bg-destructive/[0.06]",
        status === "pending" && "border border-transparent opacity-55",
        className,
      )}
      data-testid={`workflow-step-card-${status}`}
    >
      <div className="flex items-start gap-2">
        {active ? (
          <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-amber-400" strokeWidth={2} />
        ) : completed ? (
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500/90" strokeWidth={1.75} />
        ) : failed ? (
          <button
            type="button"
            onClick={onErrorClick}
            className="mt-0.5 shrink-0 text-destructive"
            aria-label="View error details"
          >
            <AlertCircle className="size-3.5" strokeWidth={1.75} />
          </button>
        ) : (
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/35" />
        )}
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "font-medium",
              failed ? "text-destructive" : active ? "text-foreground" : "text-foreground/90",
            )}
          >
            {label}
          </p>
          {sublabel ? <p className="mt-0.5 text-muted-foreground">{sublabel}</p> : null}
          {typeof progress === "number" && active && progress > 0 && progress < 100 ? (
            <p className="mt-1 text-[10px] tabular-nums text-muted-foreground">{progress}%</p>
          ) : active ? (
            <WorkingDots />
          ) : null}
          {fileDelta && (fileDelta.added != null || fileDelta.removed != null) ? (
            <p className="mt-1 font-mono text-[10px] tabular-nums text-muted-foreground">
              {fileDelta.added != null ? `+${fileDelta.added}` : ""}
              {fileDelta.removed != null ? ` -${fileDelta.removed}` : ""}
            </p>
          ) : null}
          {failed && error ? (
            <p className="mt-1 text-[10px] text-destructive/90">{error}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
