"use client";

import * as React from "react";
import type { FileDiff } from "@/lib/editor/diff";
import { diffPreviewLines } from "@/lib/editor/diff";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function AiDiffViewer({
  diffs,
  summary,
  onAccept,
  onReject,
  onAcceptAll,
  onRejectAll,
  busy,
}: {
  diffs: FileDiff[];
  summary?: string | null;
  onAccept: (path: string) => void | Promise<void>;
  onReject: (path: string) => void | Promise<void>;
  onAcceptAll: () => void | Promise<void>;
  onRejectAll: () => void | Promise<void>;
  busy?: boolean;
}) {
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());

  if (diffs.length === 0) return null;

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <div
      className="rounded-xl border border-accent/25 bg-accent/5 p-3 ring-1 ring-accent/15"
      data-testid="pending-diff-panel"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-foreground">Review AI changes</p>
          {summary && <p className="text-[11px] text-muted-foreground">{summary}</p>}
          <p className="text-[10px] text-muted-foreground">Nothing is saved until you accept.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy}
            data-testid="pending-diff-reject"
            onClick={() => void onRejectAll()}
          >
            Reject all
          </Button>
          <Button type="button" size="sm" disabled={busy} data-testid="pending-diff-accept" onClick={() => void onAcceptAll()}>
            Accept all
          </Button>
        </div>
      </div>
      <ul className="max-h-56 space-y-2 overflow-y-auto">
        {diffs.map((d) => {
          const open = expanded.has(d.path);
          const preview = diffPreviewLines(d.before, d.after, 8);
          return (
            <li key={d.path} className="rounded-lg bg-background/80 px-2 py-1.5 text-[12px] ring-1 ring-border">
              <button
                type="button"
                onClick={() => toggle(d.path)}
                className="flex w-full items-center gap-1 text-left"
              >
                <ChevronDown className={cn("size-3.5 shrink-0 transition", !open && "-rotate-90")} />
                <span className="min-w-0 flex-1 truncate font-mono font-medium">{d.path}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  +{d.addedLines} / −{d.removedLines}
                </span>
              </button>
              {open && preview.length > 0 && (
                <pre className="mt-1.5 max-h-32 overflow-auto rounded bg-muted/40 p-2 font-mono text-[10px] leading-relaxed">
                  {preview.join("\n")}
                </pre>
              )}
              <div className="mt-1.5 flex gap-2">
                <Button type="button" size="sm" disabled={busy} onClick={() => void onAccept(d.path)}>
                  Accept
                </Button>
                <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void onReject(d.path)}>
                  Reject
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
