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
import { MIN_RENDERABLE_FILES } from "@/lib/build/build-success-contract";
import { resolveBuildTerminalTruth } from "@/lib/build/build-terminal-truth";
import { AnimatedLineDelta } from "@/components/create/workspace/animated-line-delta";
import { DreamOSMessageShell } from "@/components/create/workspace/dreamos-message-shell";

function isFileEvent(ev: AgentWorkflowEvent): boolean {
  return (
    (ev.category === "file_created" || ev.category === "file_edited" || ev.category === "file_deleted") &&
    Boolean(ev.filePath && isValidWorkflowFilePath(ev.filePath))
  );
}

/** During active builds, keep one live file row + collapsed summary for completed files. */
function compressFileEventsForDisplay(
  events: AgentWorkflowEvent[],
  working: boolean,
): AgentWorkflowEvent[] {
  if (!working) return events;
  const fileEvents = events.filter(isFileEvent);
  if (fileEvents.length <= 2) return events;
  const nonFile = events.filter((e) => !isFileEvent(e));
  const activeFile =
    [...fileEvents].reverse().find((e) => e.status === "active") ?? fileEvents[fileEvents.length - 1];
  const completed = fileEvents.filter(
    (e) => e.stableKey !== activeFile?.stableKey && e.status !== "active",
  );
  if (!completed.length || !activeFile) return events;
  let added = 0;
  let removed = 0;
  for (const e of completed) {
    added += e.addedLines ?? 0;
    removed += e.removedLines ?? 0;
  }
  const summary: AgentWorkflowEvent = {
    id: "file-batch-summary",
    category: "file_created",
    title: `${completed.length} files saved`,
    subtitle: `+${added} −${removed}`,
    status: "done",
    stableKey: "file-batch-summary",
    at: completed[completed.length - 1]!.at,
    metadata: {
      file_group: completed.map((e) => e.filePath).filter(Boolean) as string[],
      collapsed_file_summary: true,
    },
  };
  return [...nonFile, summary, activeFile];
}

function groupFileEvents(events: AgentWorkflowEvent[], working: boolean): AgentWorkflowEvent[] {
  return compressFileEventsForDisplay(events, working);
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

/** Plain narration line — matches Discuss/Build chat text (no pill background). */
function WorkflowNarrationLine({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mr-6 max-w-[min(100%,34rem)] px-1 text-[13px] leading-relaxed text-foreground sm:mr-10"
      data-testid="workflow-chat-assistant"
    >
      {children}
    </p>
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
      <WorkflowNarrationLine>
        {base}
        {".".repeat(dots)}
      </WorkflowNarrationLine>
    </div>
  );
}

function mapStepStatus(event: AgentWorkflowEvent): WorkflowStepCardStatus {
  if (event.status === "active") return "active";
  if (event.status === "failed") return "failed";
  if (event.status === "done") return "completed";
  return "pending";
}

function workflowEventSavedFileCount(event: AgentWorkflowEvent): number {
  const meta = event.metadata ?? {};
  if (typeof meta.file_count === "number") return meta.file_count;
  if (typeof meta.files_persisted === "number") return meta.files_persisted;
  return 0;
}

function ProgressRow({
  event,
  reducedMotion,
  streamFileCount,
  previewSucceeded,
  workflowEvents,
}: {
  event: AgentWorkflowEvent;
  reducedMotion: boolean;
  streamFileCount: number;
  previewSucceeded: boolean;
  workflowEvents: BuildJobPollState["events"];
}) {
  const code = event.metadata?.preview_failure_code;
  const friendlyFailure =
    typeof code === "string" && isPreviewFailureCode(code)
      ? userMessageForPreviewFailure(code)
      : event.subtitle;
  const truth = resolveBuildTerminalTruth({
    workflowEvents: workflowEvents ?? [],
    persistedFileCount: streamFileCount,
    memoryFileCount: streamFileCount,
    previewRenderable: previewSucceeded,
    failureKind:
      event.status === "failed" && typeof event.metadata?.failure_kind === "string"
        ? event.metadata.failure_kind
        : event.status === "failed"
          ? "failed_before_generation"
          : null,
    persistenceConfirmed: streamFileCount >= MIN_RENDERABLE_FILES,
  });
  const recovered =
    (previewSucceeded || truth.hasRecoverableFiles) &&
    event.status === "failed" &&
    !truth.mayShowCatastrophicFailure;
  const label = recovered
    ? truth.headline
    : event.status === "failed" && truth.hasRecoverableFiles
      ? truth.headline
      : event.title;

  return (
    <motion.div
      layout={!reducedMotion}
      initial={reducedMotion ? false : { opacity: 0, y: 3 }}
      animate={{ opacity: 1, y: 0 }}
      data-testid={`workflow-event-${event.category}`}
    >
      <WorkflowStepCard
        status={recovered ? "completed" : mapStepStatus(event)}
        label={label}
        sublabel={
          recovered
            ? truth.bodyLines[0] ?? "Preview is live in the workspace."
            : event.status === "failed" && truth.hasRecoverableFiles
              ? truth.bodyLines[0] ?? friendlyFailure
              : event.status === "failed"
                ? friendlyFailure
                : event.subtitle
        }
        progress={event.progress}
        error={recovered ? undefined : event.status === "failed" ? friendlyFailure : undefined}
      />
    </motion.div>
  );
}

function isInlineWorkflowStatus(title: string): boolean {
  return /build saved.*preparing preview/i.test(title) || title === "Preparing preview";
}

function TimelineRow({
  event,
  reducedMotion,
  streamFileCount,
  previewSucceeded,
  workflowEvents,
}: {
  event: AgentWorkflowEvent;
  reducedMotion: boolean;
  streamFileCount: number;
  previewSucceeded: boolean;
  workflowEvents: BuildJobPollState["events"];
}) {
  if (isFileEvent(event)) return <FileChangeCard event={event} />;
  if (event.category === "assistant_message" || isInlineWorkflowStatus(event.title)) {
    return <WorkflowNarrationLine>{event.subtitle ?? event.title}</WorkflowNarrationLine>;
  }
  return (
    <ProgressRow
      event={event}
      reducedMotion={reducedMotion}
      streamFileCount={streamFileCount}
      previewSucceeded={previewSucceeded}
      workflowEvents={workflowEvents}
    />
  );
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
  previewSucceeded = false,
  savedFileCount = 0,
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
  previewSucceeded?: boolean;
  savedFileCount?: number;
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

  const ephemeral =
    working && serverSequential.length === 0
      ? buildEphemeralWorkflowEvents(
          startedAt,
          now,
          showAnalyzing ? undefined : openerText,
          userPrompt,
        )
      : [];
  const merged = mergeEphemeralWithServerEvents(ephemeral, serverSequential);
  const grouped = groupFileEvents(merged, working);
  const streamFileCount = Math.max(
    savedFileCount,
    grouped.filter((e) => isFileEvent(e)).length,
    (progress.events ?? []).filter((e) => e.type === "writing_file").length,
  );
  const timelineRaw = applySingleActiveWorkflowStep(grouped, working);
  const batchPersistStagger = timelineRaw.some((e) => e.metadata?.batch_persist === true);
  const timeline = useStaggeredWorkflowEvents(timelineRaw, batchPersistStagger);

  const active = [...timeline].reverse().find((e) => e.status === "active");
  const completedTimeline = active
    ? timeline.filter((ev) => ev.stableKey !== active.stableKey || isFileEvent(ev))
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

  const narrationCopy = React.useMemo(() => {
    const lines = completedTimeline
      .filter((e) => e.category === "assistant_message")
      .map((e) => e.subtitle ?? e.title);
    if (active?.category === "assistant_message") {
      lines.push(active.subtitle ?? active.title);
    }
    return lines.join("\n");
  }, [completedTimeline, active]);

  const fileSummaryLine = fileDiffSummary
    ? `Generated ${fileDiffSummary.files} files · +${fileDiffSummary.added} −${fileDiffSummary.removed}`
    : "";

  return (
    <DreamOSMessageShell
      mode="build"
      status={working ? "thinking" : "done"}
      costState={working ? "pending" : "idle"}
      messageTextForCopy={[narrationCopy, fileSummaryLine].filter(Boolean).join("\n\n") || userPrompt}
      className={className}
    >
    <div ref={streamRef} className="space-y-2.5" data-testid="agent-workflow-stream">
      {progress.reconnecting ? (
        <p className="px-1 text-[10px] text-muted-foreground">Reconnecting to build status…</p>
      ) : null}

      {showAnalyzing ? <AnalyzingRequestBubble /> : null}

      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {completedTimeline.map((ev) => (
            <li key={ev.stableKey}>
              <TimelineRow
                event={ev}
                reducedMotion={Boolean(reducedMotion)}
                streamFileCount={streamFileCount}
                previewSucceeded={previewSucceeded}
                workflowEvents={progress.events}
              />
            </li>
          ))}
        </AnimatePresence>
        {active ? (
          <li data-testid="workflow-active-step">
            <TimelineRow
              event={active}
              reducedMotion={Boolean(reducedMotion)}
              streamFileCount={streamFileCount}
              previewSucceeded={previewSucceeded}
              workflowEvents={progress.events}
            />
          </li>
        ) : null}
      </ul>

      {!working && fileDiffSummary ? (
        <p
          className="mr-6 px-1 text-[10.5px] font-medium text-muted-foreground sm:mr-10"
          data-testid="workflow-file-diff-summary"
        >
          {fileDiffSummary.files} file{fileDiffSummary.files === 1 ? "" : "s"} changed · +
          {fileDiffSummary.added} -{fileDiffSummary.removed}
        </p>
      ) : null}

      {failed && !previewSucceeded ? (
        <div className="mr-6 space-y-2 sm:mr-10">
          <p className="rounded-lg bg-destructive/10 px-2 py-1.5 text-[10.5px] text-destructive">
            {streamFileCount >= MIN_RENDERABLE_FILES
              ? "Files were saved — preview may still be loading. Open the Preview tab or retry preview."
              : progress.error ?? "App files were created, but preview needs attention."}
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
    </DreamOSMessageShell>
  );
}
