"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, Loader2, Server } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PreviewRuntimeStatusPayload } from "@/lib/preview/preview-runtime-status";
import { previewRuntimeStateLabel } from "@/lib/preview/preview-runtime-status";

export function PreviewRuntimeStatusPanel({
  status,
  compact,
  className,
}: {
  status: PreviewRuntimeStatusPayload;
  compact?: boolean;
  className?: string;
}) {
  const [logsOpen, setLogsOpen] = React.useState(false);
  const label = previewRuntimeStateLabel(status);
  const pending =
    status.jobStatus === "queued" ||
    status.jobStatus === "running" ||
    status.previewStatus === "queued";

  if (status.previewRenderable && !compact) return null;

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5 text-[11px]",
        status.previewRenderable
          ? "border-positive/30 bg-positive/5"
          : pending
            ? "border-accent/30 bg-accent/8"
            : "border-amber-500/30 bg-amber-500/8",
        className,
      )}
      data-testid="preview-runtime-status-panel"
    >
      <div className="flex items-start gap-2">
        {pending ? (
          <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-accent" />
        ) : (
          <Server className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">{label}</p>
          {!compact && (
            <p className="mt-0.5 text-muted-foreground">
              {status.workerConnected
                ? "Worker connected"
                : status.workerUnavailable
                  ? (status.workerUnavailableMessage ?? "Worker not connected")
                  : status.blockedReason ?? "Waiting for a renderable preview build."}
            </p>
          )}
        </div>
      </div>

      <dl className={cn("mt-2 grid gap-1", compact ? "grid-cols-2" : "sm:grid-cols-2")}>
        <Item label="Job" value={status.jobId ?? "—"} />
        <Item label="Job status" value={status.jobStatus ?? status.previewStatus} />
        <Item label="Framework" value={status.frameworkLabel ?? status.framework ?? "—"} />
        <Item label="Artifact" value={status.artifactPath ?? "—"} mono />
        <Item label="Renderable" value={status.previewRenderable ? "yes" : "no"} />
        <Item label="Honest" value={status.previewHonest ? "yes" : "no"} />
        {status.lockedBy ? <Item label="Worker id" value={status.lockedBy} mono /> : null}
      </dl>

      {status.buildLogs ? (
        <div className="mt-2 border-t border-border/60 pt-2">
          <button
            type="button"
            className="flex w-full items-center justify-between text-[10px] font-medium text-muted-foreground"
            onClick={() => setLogsOpen((o) => !o)}
          >
            Build logs
            {logsOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>
          {logsOpen && (
            <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[9px] text-muted-foreground">
              {status.buildLogs}
            </pre>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Item({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={cn("truncate font-medium text-foreground", mono && "font-mono text-[10px]")}>
        {value}
      </dd>
    </div>
  );
}
