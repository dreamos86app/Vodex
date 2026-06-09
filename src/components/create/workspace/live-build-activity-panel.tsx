"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BuildTerminalPhase } from "@/lib/build/build-terminal-state-machine";
import { deriveBuildActivityPresentation } from "@/lib/build/live-build-activity";

export function ChunkProgressPanel({
  progressLine,
  className,
}: {
  progressLine: string;
  className?: string;
}) {
  if (!progressLine.trim()) return null;
  return (
    <p
      className={cn(
        "mr-6 px-1 text-[10px] font-medium uppercase tracking-wide text-sky-700/90 sm:mr-10",
        className,
      )}
      data-testid="chunk-progress-panel"
    >
      Generation plan: {progressLine}
    </p>
  );
}

export function CompactLiveActivityLine({
  line,
  className,
}: {
  line: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "mr-6 flex items-center gap-1.5 px-1 text-[11px] leading-snug text-muted-foreground sm:mr-10",
        className,
      )}
      data-testid="compact-live-activity-line"
    >
      <Loader2 className="size-3 shrink-0 animate-spin opacity-60" />
      <span>{line}</span>
    </p>
  );
}

export function LiveBuildActivityPanel({
  active,
  startedAtMs,
  userPrompt = "",
  modelLabel,
  assistantMessage,
  phase = "model_generating",
  variant,
  attempt,
  maxAttempts,
  isHeartbeat = false,
  qualityScore,
  qualityTarget,
  fileCount,
  line,
  chunkProgress,
  className,
}: {
  active: boolean;
  startedAtMs?: number;
  userPrompt?: string;
  modelLabel?: string | null;
  assistantMessage?: string | null;
  phase?: BuildTerminalPhase;
  variant?: "card" | "compact";
  attempt?: number;
  maxAttempts?: number;
  isHeartbeat?: boolean;
  qualityScore?: number;
  qualityTarget?: number;
  fileCount?: number;
  line?: string;
  chunkProgress?: string;
  className?: string;
}) {
  const [now, setNow] = React.useState(Date.now());

  React.useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1200);
    return () => clearInterval(id);
  }, [active]);

  if (!active) return null;

  const elapsedMs = startedAtMs ? now - startedAtMs : 0;
  const presentation = deriveBuildActivityPresentation({
    phase,
    elapsedMs,
    userPrompt,
    assistantMessage: assistantMessage ?? undefined,
    isHeartbeat,
    attempt,
    maxAttempts,
    qualityScore,
    qualityTarget,
    fileCount,
    modelLabel: modelLabel ?? undefined,
    chunkProgress,
    activeWork: line,
  });
  const statusLine = line ?? presentation.line;
  const mode = variant ?? presentation.mode;
  const progressLine = chunkProgress ?? presentation.chunkProgress;

  if (mode === "compact") {
    return (
      <>
        {progressLine ? <ChunkProgressPanel progressLine={progressLine} /> : null}
        <CompactLiveActivityLine line={statusLine} className={className} />
      </>
    );
  }

  const elapsedSec = Math.max(0, Math.floor(elapsedMs / 1000));

  return (
    <div
      className={cn(
        "mr-6 rounded-2xl bg-gradient-to-br from-sky-50/90 via-white to-indigo-50/60 px-3 py-3 ring-1 ring-sky-200/60 sm:mr-10",
        className,
      )}
      data-testid="live-build-activity-panel"
    >
      <div className="flex items-center gap-2 text-[11px] font-semibold text-sky-800">
        <Loader2 className="size-3.5 animate-spin text-sky-600" />
        <span>Live build activity</span>
        {modelLabel ? (
          <span className="rounded-md bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-sky-700">
            {modelLabel}
          </span>
        ) : null}
        <span className="ml-auto tabular-nums text-[10px] font-medium text-muted-foreground">{elapsedSec}s</span>
      </div>
      {progressLine ? <ChunkProgressPanel progressLine={progressLine} className="mt-2 px-0" /> : null}
      <p className="mt-2 text-[12px] leading-relaxed text-foreground" data-testid="live-build-status-line">
        {statusLine}
      </p>
      {attempt != null && maxAttempts != null ? (
        <p className="mt-1 text-[10px] text-muted-foreground">
          Attempt {attempt}/{maxAttempts}
        </p>
      ) : null}
    </div>
  );
}

export function BuildFinalSummaryBlock({
  summary,
  className,
}: {
  summary: string;
  className?: string;
}) {
  if (!summary.trim()) return null;
  const lines = summary.split("\n").filter(Boolean);
  return (
    <div
      className={cn(
        "mr-6 rounded-xl bg-surface/80 px-3 py-2.5 ring-1 ring-border/60 sm:mr-10",
        className,
      )}
      data-testid="build-final-summary"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Build summary</p>
      <div className="mt-1 space-y-0.5">
        {lines.map((line) => (
          <p key={line} className="text-[11px] leading-relaxed text-foreground">
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
