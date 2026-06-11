"use client";

import * as React from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PreviewLiveDiagnosticsSnapshot } from "@/lib/preview/preview-live-diagnostics";

export function PreviewLiveDiagnosticBar({
  snapshot,
  iframeUrl,
  canonicalState,
  loadingMs,
  className,
}: {
  snapshot: PreviewLiveDiagnosticsSnapshot;
  iframeUrl?: string | null;
  canonicalState?: string;
  loadingMs?: number;
  className?: string;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const hasIssues = snapshot.errorCount > 0 || snapshot.networkFailCount > 0;

  if (!hasIssues && (loadingMs ?? 0) < 1500) return null;

  return (
    <div
      className={cn(
        "absolute bottom-2 left-2 right-2 z-40 rounded-lg border text-left shadow-lg backdrop-blur-md",
        hasIssues
          ? "border-amber-500/40 bg-amber-500/10"
          : "border-border/60 bg-background/90",
        className,
      )}
      data-testid="preview-live-diagnostic-bar"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <Radio className={cn("size-3.5 shrink-0", hasIssues ? "text-amber-600" : "text-accent")} />
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">
          {hasIssues
            ? `Preview blocked — ${snapshot.errorCount} error${snapshot.errorCount === 1 ? "" : "s"}`
            : `Loading preview… ${Math.round((loadingMs ?? 0) / 100) / 10}s`}
          {snapshot.lastBlocker ? ` · ${snapshot.lastBlocker}` : ""}
        </span>
        {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
      </button>
      {expanded ? (
        <div className="max-h-40 overflow-y-auto border-t border-border/40 px-3 py-2 text-[10px] text-muted-foreground">
          {canonicalState ? <p className="mb-1 font-mono">state={canonicalState}</p> : null}
          {iframeUrl ? (
            <p className="mb-2 truncate font-mono" title={iframeUrl}>
              src={iframeUrl}
            </p>
          ) : null}
          {snapshot.entries.length === 0 ? (
            <p className="flex items-center gap-1">
              <AlertTriangle className="size-3" /> No console errors captured yet — check Network tab.
            </p>
          ) : (
            <ul className="space-y-1">
              {snapshot.entries
                .slice()
                .reverse()
                .slice(0, 12)
                .map((e, i) => (
                  <li key={`${e.at}-${i}`} className={e.level === "error" ? "text-destructive" : ""}>
                    [{e.kind}] {e.message}
                    {e.detail ? ` (${e.detail})` : ""}
                  </li>
                ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
