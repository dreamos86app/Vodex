"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  CheckCircle2,
  ChevronDown,
  FileMinus,
  FilePen,
  FilePlus,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BuildJobPollState } from "@/hooks/use-build-job-progress";
import { pickEphemeralMicroStep } from "@/lib/build/build-micro-events";
import {
  coalesceWorkflowStreamEvents,
  deriveActiveWorkflowState,
  recentTimelineEvents,
} from "@/lib/build/workflow-stream-coalesce";
import type { AgentWorkflowEvent } from "@/lib/build/workflow-stream-types";

function useEphemeralHint(active: boolean, editing = false) {
  const [label, setLabel] = React.useState(() => pickEphemeralMicroStep(0, editing));
  React.useEffect(() => {
    if (!active) return;
    let tick = 0;
    const id = setInterval(() => {
      tick += 1;
      setLabel(pickEphemeralMicroStep(tick, editing));
    }, 2800);
    return () => clearInterval(id);
  }, [active, editing]);
  return label;
}

function WorkingDots() {
  return (
    <span className="inline-flex gap-0.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1 rounded-full bg-accent"
          animate={{ opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </span>
  );
}

function FileChangeCard({ event }: { event: AgentWorkflowEvent }) {
  const isCreate = event.category === "file_created";
  const isDelete = event.category === "file_deleted";
  const Icon = isDelete ? FileMinus : isCreate ? FilePlus : FilePen;
  const verb = isDelete ? "Deleted" : isCreate ? "Created" : "Edited";
  const path = event.filePath ?? event.title;
  const hasCounts =
    typeof event.addedLines === "number" || typeof event.removedLines === "number";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="ml-0 mr-8 flex items-center gap-2 rounded-2xl bg-surface/90 px-3 py-2 ring-1 ring-border/60 sm:mr-12"
      data-testid="workflow-file-card"
    >
      <Icon className="size-3.5 shrink-0 text-accent/85" strokeWidth={1.75} />
      <span className="shrink-0 text-[10.5px] font-medium text-muted-foreground">{verb}</span>
      <code className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-foreground">{path}</code>
      {hasCounts && !isDelete ? (
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
          {typeof event.addedLines === "number" ? `+${event.addedLines}` : ""}
          {typeof event.removedLines === "number" ? ` -${event.removedLines}` : ""}
        </span>
      ) : null}
    </motion.div>
  );
}

function TimelineRow({ event, reducedMotion }: { event: AgentWorkflowEvent; reducedMotion: boolean }) {
  if (event.category === "file_created" || event.category === "file_edited" || event.category === "file_deleted") {
    return <FileChangeCard event={event} />;
  }

  const isAssistant = event.category === "assistant_message";
  const failed = event.status === "failed";

  return (
    <motion.div
      layout={!reducedMotion}
      initial={reducedMotion ? false : { opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "ml-0 mr-8 max-w-[min(100%,28rem)] rounded-2xl px-3 py-2 text-[11px] ring-1 sm:mr-12",
        isAssistant
          ? "bg-accent/[0.08] ring-accent/25"
          : failed
            ? "bg-destructive/5 ring-destructive/25"
            : event.status === "done"
              ? "bg-surface/70 ring-border/50"
              : "bg-surface/90 ring-border/70",
      )}
      data-testid={isAssistant ? "workflow-chat-assistant" : `workflow-event-${event.category}`}
    >
      <div className="flex items-start gap-2">
        {isAssistant ? (
          <MessageSquare className="mt-0.5 size-3 shrink-0 text-accent" strokeWidth={1.75} />
        ) : event.status === "done" ? (
          <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-accent/80" strokeWidth={1.75} />
        ) : event.status === "active" ? (
          <Loader2 className="mt-0.5 size-3 shrink-0 animate-spin text-accent" strokeWidth={2} />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className={cn("font-medium", failed ? "text-destructive" : "text-foreground")}>
            {event.title}
          </p>
          {event.subtitle && event.subtitle !== event.title ? (
            <p className="mt-0.5 line-clamp-2 text-muted-foreground">{event.subtitle}</p>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}

export function AgentWorkflowStream({
  progress,
  className,
}: {
  progress: BuildJobPollState | null;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();
  const [expanded, setExpanded] = React.useState(false);
  const working = Boolean(progress && !progress.done);
  const editing = progress?.latest?.type === "editing_file";
  const ephemeral = useEphemeralHint(working && !progress?.latest?.title, Boolean(editing));

  if (!progress) return null;

  const streamEvents = coalesceWorkflowStreamEvents(progress.events, {
    terminal: progress.done,
  });
  const active = deriveActiveWorkflowState(
    streamEvents,
    progress.progressPercent,
    working ? ephemeral : undefined,
  );
  const timeline = recentTimelineEvents(streamEvents, expanded ? 24 : 8);
  const failed =
    progress.done &&
    (progress.status === "failed" || progress.latest?.type === "failed");
  const partialDone = progress.done && progress.latest?.type === "partial_credit_stop";

  return (
    <div className={cn("space-y-3", className)} data-testid="agent-workflow-stream">
      <div
        className={cn(
          "rounded-xl px-3 py-2.5 ring-1",
          failed
            ? "bg-destructive/5 ring-destructive/25"
            : partialDone
              ? "bg-amber-500/5 ring-amber-500/30"
              : "bg-accent/[0.07] ring-accent/25",
        )}
        data-testid="workflow-active-card"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {active.phaseLabel}
          </p>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {active.progressPercent}%
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          {working ? (
            <Loader2 className="size-3.5 shrink-0 animate-spin text-accent" strokeWidth={2} />
          ) : failed ? null : (
            <CheckCircle2 className="size-3.5 shrink-0 text-accent" strokeWidth={1.75} />
          )}
          <p className="min-w-0 flex-1 text-[12px] font-semibold text-foreground">
            {active.taskLabel}
            {working && !reducedMotion ? (
              <span className="ml-1.5 inline-flex align-middle">
                <WorkingDots />
              </span>
            ) : null}
          </p>
        </div>
        {active.currentFile ? (
          <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
            Current file: {active.currentFile}
          </p>
        ) : working && active.ephemeralHint ? (
          <p className="mt-1 text-[10px] text-muted-foreground">{active.ephemeralHint}</p>
        ) : null}
        {progress.latest?.detail && progress.latest.detail !== active.taskLabel ? (
          <p className="mt-1 line-clamp-2 text-[10.5px] text-muted-foreground">
            {progress.latest.detail}
          </p>
        ) : null}
      </div>

      {progress.reconnecting ? (
        <p className="px-1 text-[10px] text-muted-foreground">Reconnecting to build status…</p>
      ) : null}

      {timeline.length > 0 ? (
        <div className="space-y-1">
          <ul className={cn("space-y-1", expanded ? "max-h-72 overflow-y-auto" : "max-h-44 overflow-y-auto")}>
            <AnimatePresence initial={false}>
              {timeline.map((ev) => (
                <li key={ev.stableKey}>
                  <TimelineRow event={ev} reducedMotion={Boolean(reducedMotion)} />
                </li>
              ))}
            </AnimatePresence>
          </ul>
          {streamEvents.length > 8 ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex w-full items-center justify-center gap-1 rounded-md py-1 text-[10px] font-medium text-muted-foreground transition hover:bg-surface/80 hover:text-foreground"
            >
              {expanded ? "Show less" : "View all activity"}
              <ChevronDown
                className={cn("size-3 transition", expanded && "rotate-180")}
                strokeWidth={2}
              />
            </button>
          ) : null}
        </div>
      ) : null}

      {failed && progress.error ? (
        <p className="rounded-lg bg-destructive/10 px-2 py-1.5 text-[10.5px] text-destructive">
          {progress.error}
        </p>
      ) : null}
    </div>
  );
}
