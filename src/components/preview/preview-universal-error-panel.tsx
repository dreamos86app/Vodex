"use client";

import * as React from "react";
import {
  AlertTriangle,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  Trash2,
  Wrench,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { ResolvedPreviewState } from "@/lib/preview/resolve-preview-state";

export type PreviewUniversalErrorPanelProps = {
  resolved: ResolvedPreviewState;
  iframeUrl?: string | null;
  className?: string;
  onRetryLoad?: () => void;
  onClearCache?: () => void;
  onRebuildPreview?: () => void;
  onRunRepair?: () => void;
  onRepairPreviewState?: () => void;
  rebuilding?: boolean;
  repairing?: boolean;
  stateRepairing?: boolean;
};

export function PreviewUniversalErrorPanel({
  resolved,
  iframeUrl = null,
  className,
  onRetryLoad,
  onClearCache,
  onRebuildPreview,
  onRunRepair,
  onRepairPreviewState,
  rebuilding = false,
  repairing = false,
  stateRepairing = false,
}: PreviewUniversalErrorPanelProps) {
  const technicalDetails = React.useMemo(
    () => JSON.stringify({ ...resolved.technical, canonicalState: resolved.state, raw: resolved.raw }, null, 2),
    [resolved],
  );

  const copyDetails = () => {
    void navigator.clipboard.writeText(technicalDetails).then(
      () => toast.success("Copied technical details"),
      () => toast.error("Could not copy"),
    );
  };

  return (
    <div
      data-testid="preview-universal-error-panel"
      data-preview-canonical-state={resolved.state}
      className={cn(
        "flex max-h-full w-full max-w-2xl flex-col gap-4 overflow-auto rounded-2xl bg-background p-6 shadow-xl ring-1 ring-border",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 ring-1 ring-destructive/20">
          <AlertTriangle className="size-5 text-destructive" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-snug text-foreground">{resolved.title}</p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{resolved.summary}</p>
          <p className="mt-2 text-[10.5px] font-mono text-muted-foreground/80">
            source: {resolved.sourceOfTruth} · state: {resolved.state} · {resolved.classification}
          </p>
        </div>
      </div>

      <dl className="grid gap-1.5 rounded-xl bg-muted/40 p-3 text-[11px] font-mono text-muted-foreground">
        {resolved.technical.projectId ? (
          <div className="flex gap-2">
            <dt className="shrink-0 text-foreground/70">project</dt>
            <dd className="truncate">{String(resolved.technical.projectId)}</dd>
          </div>
        ) : null}
        {resolved.artifactId ? (
          <div className="flex gap-2">
            <dt className="shrink-0 text-foreground/70">artifact</dt>
            <dd className="truncate">{resolved.artifactId}</dd>
          </div>
        ) : null}
        {resolved.workerJobId ? (
          <div className="flex gap-2">
            <dt className="shrink-0 text-foreground/70">worker</dt>
            <dd className="truncate">
              {resolved.workerJobId} ({resolved.workerJobStatus ?? "unknown"})
            </dd>
          </div>
        ) : null}
        {iframeUrl ? (
          <div className="flex gap-2">
            <dt className="shrink-0 text-foreground/70">iframe</dt>
            <dd className="truncate" title={iframeUrl}>
              {iframeUrl}
            </dd>
          </div>
        ) : null}
        {resolved.technical.framework ? (
          <div className="flex gap-2">
            <dt className="shrink-0 text-foreground/70">framework</dt>
            <dd>{String(resolved.technical.framework)}</dd>
          </div>
        ) : null}
      </dl>

      {resolved.technical.buildLogsTail ? (
        <pre className="max-h-32 overflow-auto rounded-lg bg-muted/60 p-2.5 text-[10px] leading-relaxed text-muted-foreground">
          {String(resolved.technical.buildLogsTail)}
        </pre>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {onRetryLoad ? (
          <button
            type="button"
            onClick={onRetryLoad}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-white"
          >
            <RefreshCw className="size-3.5" strokeWidth={2} />
            Retry load
          </button>
        ) : null}
        {iframeUrl ? (
          <a
            href={iframeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 text-[12px] font-semibold ring-1 ring-border"
          >
            Open in new tab
            <ExternalLink className="size-3.5" strokeWidth={2} />
          </a>
        ) : null}
        {onClearCache ? (
          <button
            type="button"
            onClick={onClearCache}
            className="flex items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 text-[12px] font-semibold ring-1 ring-border"
          >
            <Trash2 className="size-3.5" strokeWidth={1.75} />
            Clear cache
          </button>
        ) : null}
        {onRebuildPreview ? (
          <button
            type="button"
            disabled={rebuilding}
            onClick={onRebuildPreview}
            className="flex items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 text-[12px] font-semibold ring-1 ring-border disabled:opacity-50"
          >
            {rebuilding ? <Loader2 className="size-3.5 animate-spin" /> : <Wrench className="size-3.5" />}
            {rebuilding ? "Rebuilding…" : "Rebuild preview"}
          </button>
        ) : null}
        {onRunRepair ? (
          <button
            type="button"
            disabled={repairing}
            onClick={onRunRepair}
            className="rounded-lg bg-surface px-3 py-1.5 text-[12px] font-semibold ring-1 ring-border disabled:opacity-50"
          >
            {repairing ? "Repairing…" : "Run repair"}
          </button>
        ) : null}
        {onRepairPreviewState ? (
          <button
            type="button"
            disabled={stateRepairing}
            onClick={onRepairPreviewState}
            className="rounded-lg bg-surface px-3 py-1.5 text-[12px] font-semibold ring-1 ring-border disabled:opacity-50"
          >
            {stateRepairing ? "Repairing state…" : "Repair preview state"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={copyDetails}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold ring-1 ring-border"
        >
          <Copy className="size-3.5" strokeWidth={1.75} />
          Copy technical details
        </button>
      </div>
    </div>
  );
}
