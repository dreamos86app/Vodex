"use client";

import * as React from "react";
import { ExternalLink, Hammer, Loader2, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ImportedPreviewStateResult } from "@/lib/preview/imported-preview-state";

export function ImportedPreviewEmptyState({
  classification,
  previewUrl,
  onPreparePreview,
  onRunRepair,
  onOpenNewTab,
  preparing = false,
  className,
}: {
  classification: ImportedPreviewStateResult;
  previewUrl?: string | null;
  onPreparePreview?: () => void;
  onRunRepair?: () => void;
  onOpenNewTab?: () => void;
  preparing?: boolean;
  className?: string;
}) {
  const isLoading = classification.state === "preview_loading";

  return (
    <div
      className={cn(
        "flex h-full min-h-[280px] flex-col items-center justify-center gap-4 px-6 py-10 text-center",
        className,
      )}
    >
      {isLoading ? (
        <Loader2 className="size-8 animate-spin text-accent" />
      ) : (
        <div className="flex size-12 items-center justify-center rounded-2xl bg-accent/10 ring-1 ring-accent/20">
          <Hammer className="size-5 text-accent" strokeWidth={1.75} />
        </div>
      )}

      <div className="max-w-md space-y-1.5">
        <p className="text-sm font-semibold text-foreground">{classification.title}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{classification.summary}</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {classification.showPrepareButton && onPreparePreview ? (
          <button
            type="button"
            disabled={preparing || isLoading}
            onClick={onPreparePreview}
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accent/90 disabled:opacity-60"
          >
            {preparing || isLoading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Hammer className="size-3.5" />
            )}
            Prepare imported app preview
          </button>
        ) : null}

        {classification.showRepairCta && onRunRepair ? (
          <button
            type="button"
            onClick={onRunRepair}
            className="inline-flex items-center gap-1.5 rounded-xl bg-surface px-4 py-2 text-xs font-semibold text-foreground ring-1 ring-border hover:bg-surface-raised"
          >
            <Wrench className="size-3.5" />
            Apply repair
          </button>
        ) : null}

        {classification.showOpenNewTab && previewUrl ? (
          <button
            type="button"
            onClick={() => {
              if (onOpenNewTab) onOpenNewTab();
              else window.open(previewUrl, "_blank", "noopener,noreferrer");
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-surface px-4 py-2 text-xs font-semibold text-foreground ring-1 ring-border hover:bg-surface-raised"
          >
            <ExternalLink className="size-3.5" />
            Open preview in new tab
          </button>
        ) : null}
      </div>
    </div>
  );
}
