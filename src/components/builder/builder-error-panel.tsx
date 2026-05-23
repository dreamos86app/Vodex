"use client";

import { AlertCircle, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type BuilderErrorItem = {
  id: string;
  title: string;
  message: string;
  severity: "error" | "warning" | "info";
  technical?: string;
  fixHint?: string;
};

export function BuilderErrorPanel({
  errors,
  onFixWithAi,
  onRetry,
  className,
}: {
  errors: BuilderErrorItem[];
  onFixWithAi?: (id: string) => void;
  onRetry?: (id: string) => void;
  className?: string;
}) {
  const [expanded, setExpanded] = React.useState<string | null>(null);
  if (errors.length === 0) {
    return (
      <div className={cn("rounded-xl border border-border/60 bg-surface/40 p-3 text-[11px] text-muted-foreground", className)}>
        No issues reported.
      </div>
    );
  }
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-[11px] font-semibold text-foreground">Issues</p>
      {errors.map((e) => (
        <div key={e.id} className="rounded-lg border border-border bg-surface/60 p-2">
          <button
            type="button"
            className="flex w-full items-start gap-2 text-left"
            onClick={() => setExpanded(expanded === e.id ? null : e.id)}
          >
            <AlertCircle
              className={cn(
                "mt-0.5 size-3.5 shrink-0",
                e.severity === "error" ? "text-destructive" : "text-warning",
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-foreground">{e.title}</p>
              <p className="text-[11px] text-muted-foreground">{e.message}</p>
            </div>
            {expanded === e.id ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>
          {expanded === e.id && e.technical ? (
            <pre className="mt-2 max-h-24 overflow-auto rounded bg-muted/50 p-2 text-[10px]">{e.technical}</pre>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-1">
            {onFixWithAi ? (
              <Button type="button" size="sm" variant="secondary" onClick={() => onFixWithAi(e.id)}>
                <Sparkles className="size-3" />
                Fix with AI
              </Button>
            ) : null}
            {onRetry ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => onRetry(e.id)}>
                Retry safely
              </Button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
