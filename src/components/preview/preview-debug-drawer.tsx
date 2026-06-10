"use client";

import * as React from "react";
import { Bug, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { ResolvedPreviewState } from "@/lib/preview/resolve-preview-state";
import type { PreviewIframeUrlResolution } from "@/lib/preview/preview-iframe-url-resolver";

export type PreviewDebugDrawerProps = {
  resolved: ResolvedPreviewState;
  urlResolution?: PreviewIframeUrlResolution | null;
  iframeHeaderProbe?: Record<string, string | null> | null;
  visible?: boolean;
  className?: string;
};

export function PreviewDebugDrawer({
  resolved,
  urlResolution = null,
  iframeHeaderProbe = null,
  visible = true,
  className,
}: PreviewDebugDrawerProps) {
  const [open, setOpen] = React.useState(false);
  if (!visible) return null;

  const payload = {
    canonicalState: resolved.state,
    sourceOfTruth: resolved.sourceOfTruth,
    classification: resolved.classification,
    previewRenderable: resolved.previewRenderable,
    raw: resolved.raw,
    technical: resolved.technical,
    urlResolution,
    iframeHeaders: iframeHeaderProbe,
  };

  const copyAll = () => {
    void navigator.clipboard.writeText(JSON.stringify(payload, null, 2)).then(
      () => toast.success("Copied preview debug payload"),
      () => toast.error("Could not copy"),
    );
  };

  return (
    <div
      data-testid="preview-debug-drawer"
      className={cn("border-t border-border/60 bg-background/95", className)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground hover:bg-muted/30"
      >
        <span className="flex items-center gap-1.5">
          <Bug className="size-3" strokeWidth={1.75} />
          Preview debug · {resolved.state}
        </span>
        {open ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" />}
      </button>
      {open ? (
        <div className="max-h-48 overflow-auto px-3 pb-3">
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={copyAll}
              className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] ring-1 ring-border"
            >
              <Copy className="size-2.5" />
              Copy all
            </button>
          </div>
          <pre className="whitespace-pre-wrap break-all text-[9px] font-mono text-muted-foreground">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
