"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronDown, FileMinus, FilePen, FilePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BuildJobPollState } from "@/hooks/use-build-job-progress";
import {
  applySingleActiveWorkflowStep,
  collapseRedundantPhaseStarted,
  coalesceWorkflowStreamEvents,
} from "@/lib/build/workflow-stream-coalesce";
import type { AgentWorkflowEvent } from "@/lib/build/workflow-stream-types";
import { isValidWorkflowFilePath } from "@/lib/workflow/workflow-file-path";
import {
  buildEphemeralWorkflowEvents,
  mergeEphemeralWithServerEvents,
} from "@/lib/workflow/workflow-ephemeral-steps";
import { WorkflowStepCard, type WorkflowStepCardStatus } from "@/components/create/workspace/workflow-step-card";
import { useStaggeredWorkflowEvents } from "@/hooks/use-staggered-workflow-events";
import { BuildDiagnosticsCenter } from "@/components/create/workspace/build-diagnostics-center";
import type { BuildDiagnosticsPayload } from "@/lib/build/build-diagnostics";
import { shouldAutoOpenOwnerDiagnostics } from "@/lib/build/owner-diagnostics-auto-open";
import { isDreamosOwnerEmail } from "@/lib/admin-owner";
import { useAuthStore } from "@/lib/stores/auth-store";
import { userMessageForPreviewFailure, isPreviewFailureCode } from "@/lib/preview/preview-failure-codes";
import { AnimatedLineDelta } from "@/components/create/workspace/animated-line-delta";

function isFileEvent(ev: AgentWorkflowEvent): boolean {
  return (
    (ev.category === "file_created" || ev.category === "file_edited" || ev.category === "file_deleted") &&
    Boolean(ev.filePath && isValidWorkflowFilePath(ev.filePath))
  );
}

function groupFileEvents(events: AgentWorkflowEvent[]): AgentWorkflowEvent[] {
  const out: AgentWorkflowEvent[] = [];
  let i = 0;
  while (i < events.length) {
    const ev = events[i];
    if (!isFileEvent(ev)) {
      out.push(ev);
      i += 1;
      continue;
    }
    const batch: AgentWorkflowEvent[] = [ev];
    let j = i + 1;
    while (j < events.length && isFileEvent(events[j])) {
      batch.push(events[j]);
      j += 1;
    }
    if (batch.length >= 4) {
      out.push({
        id: `group-${batch[0].id}`,
        category: "file_created",
        title: `Created ${batch.length} files`,
        status: batch.some((b) => b.status === "active") ? "active" : "done",
        at: batch[batch.length - 1].at,
        stableKey: `file-group:${batch[0].stableKey}`,
        metadata: { file_group: batch.map((b) => b.filePath).filter(Boolean) },
      });
    } else {
      out.push(...batch);
    }
    i = j;
  }
  return out;
}

function FileChangeCard({ event }: { event: AgentWorkflowEvent }) {
  const paths = Array.isArray(event.metadata?.file_group)
    ? (event.metadata.file_group as string[])
    : null;
  const [open, setOpen] = React.useState(false);

  if (paths && paths.length > 0) {
    return (
      <div className="mr-6 sm:mr-10" data-testid="workflow-file-group">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full max-w-md items-center gap-2 rounded-2xl bg-surface/90 px-3 py-2 text-left ring-1 ring-border/60"
        >
          <FilePlus className="size-3.5 shrink-0 text-accent/85" />
          <span className="text-[10.5px] font-medium text-foreground">{event.title}</span>
          <ChevronDown className={cn("ml-auto size-3.5 transition", open && "rotate-180")} />
        </button>
        {open ? (
          <ul className="mt-1 max-w-md space-y-1 pl-2">
            {paths.map((p) => (
              <li key={p}>
                <code className="font-mono text-[10px] text-muted-foreground">{p}</code>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  const isCreate = event.category === "file_created";
  const isDelete = event.category === "file_deleted";
  const Icon = isDelete ? FileMinus : isCreate ? FilePlus : FilePen;
  const prefix = isDelete ? "−" : isCreate ? "+" : "~";
  const path = event.filePath!;
  const parsedFromSubtitle = (() => {
    const d = event.subtitle ?? "";
    const m = d.match(/\+(\d+)\s*-\s*(\d+)/);
    if (!m) return {};
    return { added: Number(m[1]), removed: Number(m[2]) };
  })();
  const addedLines = event.addedLines ?? parsedFromSubtitle.added;
  const removedLines = event.removedLines ?? parsedFromSubtitle.removed;
  const hasCounts = typeof addedLines === "number" || typeof removedLines === "number";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "mr-6 flex max-w-md items-center gap-2 rounded-2xl bg-surface/90 px-3 py-2 sm:mr-10",
        event.status === "active"
          ? "workflow-gold-border-active file-active-ring ring-1 ring-amber-400/55"
          : "ring-1 ring-border/60",
      )}
      data-testid="workflow-file-card"
    >
      <Icon className="size-3.5 shrink-0 text-accent/85" strokeWidth={1.75} />
      <span className="shrink-0 font-mono text-[10.5px] font-semibold text-muted-foreground">{prefix}</span>
      <code className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-foreground">{path}</code>
      {hasCounts && !isDelete ? (
        <AnimatedLineDelta
          added={addedLines}
          removed={removedLines}
          active={event.status === "active"}
        />
      ) : null}
    </motion.div>
  );
}

function AssistantBubble({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mr-6 max-w-[min(100%,34rem)] rounded-2xl bg-accent/[0.07] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-foreground ring-1 ring-accent/20 sm:mr-10"
      data-testid="workflow-chat-assistant"
    >
      {children}
    </div>
  );
}

function AnalyzingRequestBubble({ base = "Analyzing your request" }: { base?: string }) {
  const [dots, setDots] = React.useState(1);
  React.useEffect(() => {
    const id = setInterval(() => setDots((d) => (d >= 3 ? 1 : d + 1)), 420);
    return () => clearInterval(id);
  }, []);
  return (
    <div data-testid="analyzing-request-message">
      <AssistantBubble>
        {base}
        {".".repeat(dots)}
      </AssistantBubble>
    </div>
  );
}

function mapStepStatus(event: AgentWorkflowEvent): WorkflowStepCardStatus {
  if (event.status === "active") return "active";
  if (event.status === "failed") return "failed";
  if (event.status === "done") return "completed";
  return "pending";
}

function ProgressRow({ event, reducedMotion }: { event: AgentWorkflowEvent; reducedMotion: boolean }) {
  const code = event.metadata?.preview_failure_code;
  const friendlyFailure =
    typeof code === "string" && isPreviewFailureCode(code)
      ? userMessageForPreviewFailure(code)
      : event.subtitle;

  return (
    <motion.div
      layout={!reducedMotion}
      initial={reducedMotion ? false : { opacity: 0, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      data-testid={`workflow-event-${event.category}`}
    >
      <WorkflowStepCard
        status={mapStepStatus(event)}
        label={event.title}
        sublabel={event.status === "failed" ? friendlyFailure : event.subtitle}
        progress={event.progress}
        error={event.status === "failed" ? friendlyFailure : undefined}
      />
    </motion.div>
  );
}

function TimelineRow({ event, reducedMotion }: { event: AgentWorkflowEvent; reducedMotion: boolean }) {
  if (isFileEvent(event)) return <FileChangeCard event={event} />;
  if (event.category === "assistant_message") {
    return <AssistantBubble>{event.subtitle ?? event.title}</AssistantBubble>;
  }
  return <ProgressRow event={event} reducedMotion={reducedMotion} />;
}

/** Build activity as chat rows — parent chat column owns scrolling. */
export function AgentWorkflowStream({
  progress,
  className,
  buildStartedAtMs,
  openerText,
  userPrompt,
  projectId,
  ownerDiagnostics,
}: {
  progress: BuildJobPollState | null;
  className?: string;
  buildStartedAtMs?: number;
  openerText?: string;
  userPrompt?: string;
  projectId?: string;
  /** When set, parent owns diagnostics modal (single launcher). */
  ownerDiagnostics?: {
    open: boolean;
    onOpen: () => void;
  };
}) {
  const reducedMotion = useReducedMotion();
  const email = useAuthStore((s) => s.user?.email);
  const adminDiagnostics = isDreamosOwnerEmail(email);
  const [diagOpen, setDiagOpen] = React.useState(false);
  const [diagPayload, setDiagPayload] = React.useState<BuildDiagnosticsPayload | null>(null);
  const controlledDiag = Boolean(ownerDiagnostics);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (!progress || progress.done) return;
    const t = setInterval(() => setNow(Date.now()), 450);
    return () => clearInterval(t);
  }, [progress]);

  const failed = Boolean(
    progress &&
      progress.done &&
      (progress.status === "failed" || progress.latest?.type === "failed"),
  );

  React.useEffect(() => {
    if (controlledDiag || !failed || !adminDiagnostics || !projectId || !progress?.jobId) return;
    void fetch(
      `/api/projects/${projectId}/build-jobs/${progress.jobId}/diagnostics`,
      { credentials: "include" },
    )
      .then((r) => r.json())
      .then((body: { ok?: boolean; diagnostics?: BuildDiagnosticsPayload }) => {
        if (body.ok && body.diagnostics) setDiagPayload(body.diagnostics);
      })
      .catch(() => undefined);
  }, [controlledDiag, failed, adminDiagnostics, projectId, progress?.jobId]);

  const autoOpenFailure = Boolean(
    failed &&
      shouldAutoOpenOwnerDiagnostics({
        failureCode:
          typeof progress?.latest?.metadata?.preview_failure_code === "string"
            ? progress.latest.metadata.preview_failure_code
            : null,
        blockedReason: progress?.error,
        errorMessage: progress?.error,
      }),
  );

  React.useEffect(() => {
    if (controlledDiag) {
      if (adminDiagnostics && autoOpenFailure && ownerDiagnostics) {
        ownerDiagnostics.onOpen();
      }
      return;
    }
    if (!adminDiagnostics || !autoOpenFailure) return;
    if (diagPayload) setDiagOpen(true);
  }, [controlledDiag, adminDiagnostics, autoOpenFailure, diagPayload, ownerDiagnostics]);

  if (!progress) return null;

  const working = !progress.done;
  const serverRaw = coalesceWorkflowStreamEvents(progress.events ?? [], {
    terminal: progress.done,
  });
  const serverCollapsed = collapseRedundantPhaseStarted(serverRaw);
  const serverSequential = applySingleActiveWorkflowStep(serverCollapsed, working);

  const startedAt =
    buildStartedAtMs ??
    (Date.parse(progress.events?.[0]?.created_at ?? "") || now - 500);
  const showAnalyzing =
    working &&
    (openerText?.toLowerCase().startsWith("analyzing") ?? false) &&
    serverSequential.length < 1;

  const hasServerActivity = serverSequential.some(
    (e) => e.status === "active" || e.category === "file_created" || e.category === "file_edited",
  );
  const ephemeral =
    working && (!hasServerActivity || serverSequential.length < 2)
      ? buildEphemeralWorkflowEvents(
          startedAt,
          now,
          showAnalyzing ? undefined : openerText,
          userPrompt,
        )
      : [];
  const merged = mergeEphemeralWithServerEvents(ephemeral, serverSequential);
  const grouped = groupFileEvents(merged);
  const timelineRaw = applySingleActiveWorkflowStep(grouped, working).slice(-24);
  const batchPersistStagger = timelineRaw.some((e) => e.metadata?.batch_persist === true);
  const timeline = useStaggeredWorkflowEvents(timelineRaw, batchPersistStagger);

  const active = [...timeline].reverse().find((e) => e.status === "active");
  const completedTimeline = active
    ? timeline.filter((ev) => ev.stableKey !== active.stableKey)
    : timeline;

  const fileDiffSummary = React.useMemo(() => {
    let files = 0;
    let added = 0;
    let removed = 0;
    for (const ev of timeline) {
      if (!isFileEvent(ev)) continue;
      files += 1;
      added += ev.addedLines ?? 0;
      removed += ev.removedLines ?? 0;
    }
    if (files === 0) return null;
    return { files, added, removed };
  }, [timeline]);

  const streamRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!working || !active) return;
    const el = streamRef.current;
    if (!el) return;
    el.scrollIntoView({ block: "end", behavior: reducedMotion ? "auto" : "smooth" });
  }, [active?.stableKey, working, reducedMotion]);

  return (
    <div ref={streamRef} className={cn("space-y-2.5", className)} data-testid="agent-workflow-stream">
      {progress.reconnecting ? (
        <p className="px-1 text-[10px] text-muted-foreground">Reconnecting to build status…</p>
      ) : null}

      {showAnalyzing ? <AnalyzingRequestBubble /> : null}

      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {completedTimeline.map((ev) => (
            <li key={ev.stableKey}>
              <TimelineRow event={ev} reducedMotion={Boolean(reducedMotion)} />
            </li>
          ))}
        </AnimatePresence>
        {active ? (
          <li data-testid="workflow-active-step">
            <TimelineRow event={active} reducedMotion={Boolean(reducedMotion)} />
          </li>
        ) : null}
      </ul>

      {fileDiffSummary ? (
        <p
          className="mr-6 px-1 text-[10.5px] font-medium text-muted-foreground sm:mr-10"
          data-testid="workflow-file-diff-summary"
        >
          {fileDiffSummary.files} file{fileDiffSummary.files === 1 ? "" : "s"} changed · +
          {fileDiffSummary.added} -{fileDiffSummary.removed}
        </p>
      ) : null}

      {failed ? (
        <div className="mr-6 space-y-2 sm:mr-10">
          <p className="rounded-lg bg-destructive/10 px-2 py-1.5 text-[10.5px] text-destructive">
            {progress.error ?? "App files were created, but preview needs attention."}
          </p>
          {adminDiagnostics ? (
            <button
              type="button"
              onClick={() => {
                if (controlledDiag && ownerDiagnostics) ownerDiagnostics.onOpen();
                else setDiagOpen(true);
              }}
              className="text-[10px] font-medium text-amber-500 underline"
              data-testid="open-build-diagnostics"
            >
              Open diagnostics center
            </button>
          ) : null}
        </div>
      ) : null}

      {!controlledDiag ? (
        <BuildDiagnosticsCenter
          open={diagOpen}
          onClose={() => setDiagOpen(false)}
          diagnostics={diagPayload}
        />
      ) : null}
    </div>
  );
}
