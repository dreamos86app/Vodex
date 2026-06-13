"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { WorkflowRunStatus } from "@/lib/build/workflow-status-guards";
import { MIN_RENDERABLE_FILES } from "@/lib/build/build-success-contract";
import {
  guardCatastrophicHeadline,
  resolveBuildTerminalTruth,
} from "@/lib/build/build-terminal-truth";
import { CONTINUE_GENERATION_LABEL } from "@/lib/build/build-user-copy";

export type BuildRunSummaryVariant = "completed" | "partial" | "failed" | "inline";

function isPendingPreviewHeadline(title: string): boolean {
  return /build saved.*preparing preview/i.test(title);
}

export function BuildRunSummaryCard({
  variant,
  status,
  headline,
  bodyLines = [],
  appName,
  filesCount,
  pages,
  previewReady,
  publishReady,
  creditsUsed,
  errorMessage,
  failureCode,
  refunded,
  showRefundLine = false,
  showRepairActions = false,
  showPreviewActions = false,
  showContinueGeneration = false,
  onContinue,
  onRepair,
  className,
}: {
  variant: BuildRunSummaryVariant;
  status?: WorkflowRunStatus;
  headline?: string;
  bodyLines?: string[];
  appName?: string;
  filesCount?: number;
  pages?: string[];
  previewReady?: boolean;
  publishReady?: boolean;
  creditsUsed?: number;
  completedSummary?: string;
  remainingSummary?: string;
  errorMessage?: string;
  failureCode?: string;
  refunded?: boolean;
  showRefundLine?: boolean;
  showRepairActions?: boolean;
  showPreviewActions?: boolean;
  showContinueGeneration?: boolean;
  onContinue?: () => void;
  onRepair?: () => void;
  className?: string;
}) {
  const partial = variant === "partial" || status === "partial_credit_stop";
  const failed = variant === "failed";

  const count = typeof filesCount === "number" ? filesCount : 0;
  const truth = resolveBuildTerminalTruth({
    persistedFileCount: count,
    memoryFileCount: count,
    previewRenderable: previewReady,
    failureKind: status === "failed_before_generation" ? "failed_before_generation" : null,
    persistenceConfirmed: count >= MIN_RENDERABLE_FILES,
  });
  const title = guardCatastrophicHeadline(
    truth.hasRecoverableFiles && count >= MIN_RENDERABLE_FILES
      ? truth.headline
      : headline ??
          (failed
            ? status === "quality_below_floor"
              ? "Build paused — app is not ready yet"
              : status === "preview_failed"
                ? "Build saved — preview needs repair"
                : status === "failed_before_generation"
                  ? "Couldn't start the build"
                  : "Build needs attention"
            : partial
              ? "Build saved — next steps queued"
              : "Build complete"),
    (truth.hasRecoverableFiles || count >= MIN_RENDERABLE_FILES) && count >= MIN_RENDERABLE_FILES,
    count,
  );
  const inline = true;

  const lines =
    bodyLines.length > 0
      ? bodyLines
      : [
          ...(variant === "completed" && typeof filesCount === "number"
            ? [`${filesCount} file${filesCount === 1 ? "" : "s"} created or updated`]
            : []),
          ...(pages?.length ? [`Screens: ${pages.slice(0, 5).join(", ")}`] : []),
          ...(partial && typeof creditsUsed === "number"
            ? [`Used ${creditsUsed} Build Credit${creditsUsed === 1 ? "" : "s"} on this pass.`]
            : []),
          ...(failed && failureCode ? [`Error: ${failureCode.replace(/_/g, " ")}`] : []),
          ...(failed && errorMessage ? [errorMessage] : []),
          ...(showRefundLine && refunded ? ["Credits were returned for this attempt."] : []),
        ].filter(Boolean);

  if (inline) {
    const detail = lines[0] ?? (typeof filesCount === "number" ? `${filesCount} files saved to your project` : null);
    return (
      <div className={cn("px-1 py-0.5", className)} data-testid="build-run-summary-inline">
        <p className="text-[13px] leading-relaxed text-foreground">{title}</p>
        {detail ? <p className="mt-0.5 text-[12px] text-muted-foreground">{detail}</p> : null}
        {showPreviewActions && count >= MIN_RENDERABLE_FILES ? (
          <button
            type="button"
            className="mt-2 text-[12px] font-medium text-accent underline-offset-2 hover:underline"
            data-testid="summary-open-preview"
          >
            Open preview
          </button>
        ) : null}
        {showContinueGeneration && onContinue ? (
          <button
            type="button"
            onClick={onContinue}
            className="mt-2 rounded-xl bg-accent px-3 py-2 text-[12px] font-semibold text-white"
            data-testid="summary-continue-generation"
          >
            {CONTINUE_GENERATION_LABEL}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl bg-gradient-to-br from-background via-surface to-background shadow-[0_4px_16px_-4px_rgba(0,0,0,0.3)] ring-1",
        failed ? "ring-destructive/30" : partial ? "ring-amber-500/30" : "ring-accent/30",
        className,
      )}
      data-testid="build-run-summary"
      data-variant={variant}
      data-status={status}
    >
      <div
        className={cn(
          "h-[2px] w-full bg-gradient-to-r",
          failed
            ? "from-destructive/80 to-destructive/40"
            : partial
              ? "from-amber-500 via-orange-400 to-amber-600"
              : "from-violet-600 via-accent to-sky-500",
        )}
      />
      <div className="px-4 py-3.5">
        <p className="text-[13px] font-semibold text-foreground">{title}</p>
        {appName && variant === "completed" ? (
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">{appName}</p>
        ) : null}

        {lines.length > 0 ? (
          <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}

        {variant === "completed" && previewReady != null ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Preview: {previewReady ? "Ready" : "Preparing"}
            {publishReady != null
              ? ` · Publish: ${publishReady ? "Ready when you are" : "Finish setup in dashboard"}`
              : ""}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          {showPreviewActions && count >= MIN_RENDERABLE_FILES && (
            <button
              type="button"
              className="rounded-xl bg-accent px-3 py-2 text-[11.5px] font-semibold text-white shadow-sm"
              data-testid="summary-open-preview"
            >
              Open preview
            </button>
          )}
          {(showContinueGeneration || partial) && onContinue ? (
            <button
              type="button"
              onClick={onContinue}
              className="rounded-xl bg-accent px-3 py-2 text-[11.5px] font-semibold text-white shadow-sm"
              data-testid="summary-continue-generation"
            >
              {showContinueGeneration ? CONTINUE_GENERATION_LABEL : "Continue build"}
            </button>
          ) : null}
          {showRepairActions && onRepair ? (
            <button
              type="button"
              onClick={onRepair}
              className="rounded-xl border border-border/70 bg-background px-3 py-2 text-[11.5px] font-medium text-foreground"
              data-testid="summary-repair-build"
            >
              Repair build
            </button>
          ) : null}
          {partial || (failed && status === "insufficient_credits_before_start") ? (
            <>
              <Link
                href="/pricing"
                className="rounded-xl bg-surface px-3 py-2 text-[11.5px] font-medium text-foreground ring-1 ring-border"
              >
                {failed && status === "insufficient_credits_before_start" ? "Upgrade" : "Add credits"}
              </Link>
              {partial ? (
                <button
                  type="button"
                  className="rounded-xl bg-surface px-3 py-2 text-[11.5px] font-medium text-muted-foreground ring-1 ring-border"
                >
                  Continue later
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
