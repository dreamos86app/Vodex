"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BuildTerminalPhase } from "@/lib/build/build-terminal-state-machine";
import {
  BUILD_STEP_ACCENT_CLASS,
  BUILD_STEP_LABEL,
  BUILD_STEP_RING_CLASS,
  resolveBuildStepUiKind,
  type BuildStepUiKind,
} from "@/lib/build/build-step-ui";

export function BuildStepPhaseCard({
  phase,
  working,
  paused = false,
  hasFiles = false,
  statusLine,
  chunkProgress,
  className,
}: {
  phase: BuildTerminalPhase;
  working: boolean;
  paused?: boolean;
  hasFiles?: boolean;
  statusLine?: string;
  chunkProgress?: string;
  className?: string;
}) {
  const kind: BuildStepUiKind = resolveBuildStepUiKind({ phase, working, paused, hasFiles });
  const label = BUILD_STEP_LABEL[kind];

  const goldActive =
    working &&
    !paused &&
    (kind === "parsing" || kind === "generating" || kind === "planning");

  return (
    <div
      className={cn(
        "mr-6 rounded-2xl px-3.5 py-3 sm:mr-10",
        BUILD_STEP_RING_CLASS[kind],
        goldActive &&
          "workflow-gold-border-active workflow-active-ring shadow-[0_0_20px_-4px_rgba(251,191,36,0.45)]",
        className,
      )}
      data-testid="build-step-phase-card"
      data-step-kind={kind}
    >
      <div className="flex items-center gap-2">
        {working && kind !== "paused" && kind !== "done" ? (
          <Loader2 className={cn("size-3.5 shrink-0 animate-spin", BUILD_STEP_ACCENT_CLASS[kind])} />
        ) : null}
        <span className={cn("text-[11px] font-bold uppercase tracking-wide", BUILD_STEP_ACCENT_CLASS[kind])}>
          {label}
        </span>
        {chunkProgress ? (
          <span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground">
            {chunkProgress}
          </span>
        ) : null}
      </div>
      {statusLine ? (
        <p className="mt-1.5 text-[12px] leading-snug text-foreground" data-testid="build-step-status-line">
          {statusLine}
        </p>
      ) : null}
    </div>
  );
}
