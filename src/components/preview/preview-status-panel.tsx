"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Loader2, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { RepairCenter } from "@/components/repair/repair-center";
import { PREVIEW_LEVEL_LABELS, type PreviewProviderLevel } from "@/lib/preview/preview-provider-types";

export function PreviewStatusPanel({
  projectId,
  status,
  logs,
  previewUrl,
  providerLevel,
  lifecycleStatus,
  errorMessage,
  onRetry,
  className,
}: {
  projectId: string;
  status: "idle" | "starting" | "ready" | "failed";
  logs?: string[];
  previewUrl?: string | null;
  providerLevel?: string;
  lifecycleStatus?: string | null;
  errorMessage?: string | null;
  onRetry?: () => void;
  className?: string;
}) {
  const icon =
    status === "ready" ? (
      <CheckCircle2 className="size-4 text-positive" />
    ) : status === "failed" ? (
      <AlertCircle className="size-4 text-destructive" />
    ) : (
      <Loader2 className={cn("size-4 text-accent", status === "starting" && "animate-spin")} />
    );

  const providerCopy = (() => {
    if (!providerLevel) return null;
    const label = PREVIEW_LEVEL_LABELS[providerLevel as PreviewProviderLevel] ?? providerLevel;
    if (providerLevel === "external_hosted") return `${label} — real hosted URL from Vercel.`;
    if (providerLevel === "vercel_preview") return `${label} — hosted preview pending or unavailable; in-app snapshot is active.`;
    if (providerLevel === "static_snapshot") return `${label} — interactive React features may be limited.`;
    return `${label} — in-app session preview.`;
  })();

  return (
    <div className={cn("rounded-xl bg-surface p-4 ring-1 ring-border", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          {icon}
          Preview status
        </div>
        {lifecycleStatus && (
          <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-medium ring-1 ring-border">
            Lifecycle: {lifecycleStatus}
          </span>
        )}
      </div>
      <p className="mt-1 text-[12px] text-muted-foreground">
        {status === "ready" && previewUrl
          ? "Preview is live and shareable."
          : status === "failed"
            ? errorMessage ?? "Preview failed — see logs and repair options."
            : status === "starting"
              ? "Starting preview session…"
              : "Preview not started — generate the app first."}
      </p>
      {providerCopy && <p className="mt-1 text-[11px] text-muted-foreground">{providerCopy}</p>}
      {logs && logs.length > 0 && (
        <details className="mt-3" open={status === "failed"}>
          <summary className="cursor-pointer text-[11px] font-medium text-foreground">Session logs ({logs.length})</summary>
          <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-background p-2 text-[10px] text-muted-foreground ring-1 ring-border">
            {logs.join("\n")}
          </pre>
        </details>
      )}
      {status === "failed" && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[11px] font-semibold text-white"
        >
          <Wrench className="size-3.5" />
          Retry preview
        </button>
      )}
      {(status === "failed" || status === "idle") && (
        <RepairCenter projectId={projectId} className="mt-3" compact={status === "failed"} />
      )}
    </div>
  );
}
