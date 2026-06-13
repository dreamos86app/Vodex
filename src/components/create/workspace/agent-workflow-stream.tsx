"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown, FileMinus, FilePen, FilePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BuildJobPollState } from "@/hooks/use-build-job-progress";
import {
  applySingleActiveWorkflowStep,
  collapseDuplicateAssistantMessages,
  collapseHeartbeatAssistantMessages,
  collapseRedundantPhaseStarted,
  coalesceWorkflowStreamEvents,
  limitTerminalNarration,
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
import { LiveFileLineDelta } from "@/components/create/workspace/live-file-line-delta";
import { DreamOSMessageShell } from "@/components/create/workspace/dreamos-message-shell";
import {
  deriveBuildPhaseFromEvents,
} from "@/lib/build/build-terminal-state-machine";
import { sanitizeUserBuildChatText } from "@/lib/build/build-user-copy";
import { BuildStepPhaseCard } from "@/components/create/workspace/build-step-phase-card";
import { BuildNoFilesYetCard } from "@/components/create/workspace/build-no-files-yet-card";
import { NO_FILES_YET_THRESHOLD_MS, BUILD_USER_TIMEOUT_MS } from "@/lib/build/build-step-ui";
import { buildInterleavedWorkflowDisplay } from "@/lib/workflow/workflow-interleaved-timeline";
import { buildStepHeartbeatLine } from "@/lib/workflow/workflow-step-heartbeat";
import { useSequentialWorkflowReveal } from "@/hooks/use-sequential-workflow-reveal";
import { BuildFinalSummaryBlock } from "@/components/create/workspace/live-build-activity-panel";
import { BuildFailureDiagnosticsInline } from "@/components/create/workspace/build-failure-diagnostics-inline";

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
  if (fileEvents.some((e) => e.metadata?.file_in_progress === true || e.status === "active")) {
    return events;
  }
  if (fileEvents.length <= 8) return events;
  const nonFile = events.filter((e) => !isFileEvent(e));
  const activeFile =
    [...fileEvents].reverse().find((e) => e.status === "active") ?? fileEvents[fileEvents.length - 1];
  const completed = fileEvents.filter(
    (e) => e.stableKey !== activeFile?.stableKey && e.status !== "active",
  );
  if (!completed.length || !activeFile) return events;
  const summary: AgentWorkflowEvent = {
    id: "file-batch-summary",
    category: "file_created",
    title: `${completed.length} files saved`,
    subtitle: undefined,
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

function dedupeFileStreamEvents(events: AgentWorkflowEvent[]): AgentWorkflowEvent[] {
  const byPath = new Map<string, AgentWorkflowEvent>();
  for (const ev of events) {
    if (!ev.filePath) continue;
    const key = ev.filePath.replace(/\\/g, "/").toLowerCase();
    const prev = byPath.get(key);
    if (!prev || Date.parse(ev.at) >= Date.parse(prev.at)) {
      byPath.set(key, ev);
    }
  }
  return [...byPath.values()].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

function isHeartbeatNarration(ev: AgentWorkflowEvent): boolean {
  return ev.metadata?.heartbeat === true;
}

/** Files-first UI: hide narration history; diagnostics retain full event log. */
function isStructuralTimelineEvent(ev: AgentWorkflowEvent, working: boolean): boolean {
  if (isFileEvent(ev)) return false;
  if (ev.category === "assistant_message") return false;
  if (isHeartbeatNarration(ev)) return false;
  if (working && ev.category === "phase_started") return false;
  if (working && ev.category === "task_started") return false;
  return true;
}

const MAX_ACTIVE_FILE_ROWS = 1;

/** Golden-ring focus on all files actively being written. */
function applyFileStreamFocus(
  events: AgentWorkflowEvent[],
  working: boolean,
): AgentWorkflowEvent[] {
  if (!working) return events;

  const inProgressIndices: number[] = [];
  events.forEach((e, i) => {
    if (isFileEvent(e) && (e.metadata?.file_in_progress === true || e.status === "active")) {
      inProgressIndices.push(i);
    }
  });
  const activeSet = new Set(inProgressIndices.slice(-MAX_ACTIVE_FILE_ROWS));

  return events.map((e, i) => {
    if (isFileEvent(e)) {
      const inProgress =
        e.metadata?.file_in_progress === true ||
        (e.status === "active" && e.metadata?.file_in_progress !== false);
      const focused = inProgress && activeSet.has(i);
      const done =
        e.metadata?.file_in_progress === false ||
        e.metadata?.step_status === "completed" ||
        (!focused && !inProgress);
      return {
        ...e,
        status: focused ? ("active" as const) : done ? ("done" as const) : e.status,
      };
    }
    if (e.status === "active") {
      return { ...e, status: "done" as const };
    }
    return e;
  });
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
  const path = event.filePath!;
  const parsedFromSubtitle = (() => {
    const d = event.subtitle ?? "";
    const m = d.match(/\+(\d+)\s*[-−](\d+)/);
    if (!m) return {};
    return { added: Number(m[1]), removed: Number(m[2]) };
  })();
  const addedLines = event.addedLines ?? parsedFromSubtitle.added;
  const removedLines = event.removedLines ?? parsedFromSubtitle.removed;
  const fileActive = event.status === "active" && event.metadata?.file_in_progress !== false;
  const preparing =
    fileActive &&
    (addedLines == null || addedLines === 0) &&
    (removedLines == null || removedLines === 0);

  return (
    <div className="mr-6 overflow-visible p-0.5 sm:mr-10">
      <div
        className={cn(
          "flex max-w-md items-center gap-2 rounded-2xl bg-surface/90 px-3 py-2",
          fileActive
            ? "workflow-gold-border-active file-active-ring ring-2 ring-amber-400/45 shadow-[0_0_20px_-4px_rgba(251,191,36,0.45)]"
            : "ring-1 ring-border/60",
        )}
        data-testid="workflow-file-card"
      >
        <Icon className="size-3.5 shrink-0 text-accent/85" strokeWidth={1.75} />
        <code className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-foreground">{path}</code>
        {!isDelete ? (
          preparing ? (
            <span className="shrink-0 text-[10px] font-medium text-muted-foreground">Preparing…</span>
          ) : (
            <LiveFileLineDelta
              path={path}
              active={fileActive}
              added={addedLines}
              removed={removedLines}
            />
          )
        ) : null}
      </div>
    </div>
  );
}

function NarrationLine({ text }: { text: string }) {
  return <WorkflowNarrationLine>{text}</WorkflowNarrationLine>;
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
  if (event.category === "assistant_message" && event.status === "active") {
    return (
      <ProgressRow
        event={{
          ...event,
          category: "phase_started",
          title: "Working on it…",
          subtitle: event.subtitle ?? event.title,
        }}
        reducedMotion={reducedMotion}
        streamFileCount={streamFileCount}
        previewSucceeded={previewSucceeded}
        workflowEvents={workflowEvents}
      />
    );
  }
  if (event.category === "assistant_message" || isInlineWorkflowStatus(event.title)) {
    return null;
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
  modelLabel = null,
}: {
  progress: BuildJobPollState | null;
  className?: string;
  buildStartedAtMs?: number;
  openerText?: string;
  userPrompt?: string;
  projectId?: string;
  modelLabel?: string | null;
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
  const serverNoHeartbeat = collapseHeartbeatAssistantMessages(serverRaw);
  const serverDeduped = collapseDuplicateAssistantMessages(serverNoHeartbeat);
  const serverLimited = limitTerminalNarration(serverDeduped, progress.done);
  const serverCollapsed = collapseRedundantPhaseStarted(serverLimited);
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
  const rawFileStreamEvents = dedupeFileStreamEvents(
    applyFileStreamFocus(
      merged.filter(isFileEvent),
      working,
    ),
  );
  const grouped = groupFileEvents(merged, working);
  const terminalMeta = (progress.latest?.metadata ?? {}) as Record<string, unknown>;
  const failedDraft =
    terminalMeta.failed_draft === true || terminalMeta.continuing_generation_needed === true;
  const qualityBlocked = terminalMeta.failure_kind === "quality_below_floor";
  const persistedMeta =
    typeof terminalMeta.files_persisted === "number" ? terminalMeta.files_persisted : undefined;
  const streamFileCount =
    progress.done && (failedDraft || qualityBlocked || persistedMeta === 0)
      ? savedFileCount
      : Math.max(
          savedFileCount,
          persistedMeta ?? 0,
          grouped.filter((e) => isFileEvent(e)).length,
          (progress.events ?? []).filter((e) => e.type === "writing_file").length,
        );
  const timelineRaw = applySingleActiveWorkflowStep(grouped, working);
  const shouldStaggerFiles = false;
  const timelineStaggered = useStaggeredWorkflowEvents(timelineRaw, shouldStaggerFiles);
  const timeline = applyFileStreamFocus(timelineStaggered, working);

  const structuralTimeline = timeline.filter((ev) => isStructuralTimelineEvent(ev, working));
  const active = [...structuralTimeline]
    .reverse()
    .find((e) => e.status === "active");
  const completedTimeline = active
    ? structuralTimeline.filter((ev) => ev.stableKey !== active.stableKey)
    : structuralTimeline;

  const fileDiffSummary = React.useMemo(() => {
    let files = 0;
    let added = 0;
    let removed = 0;
    for (const ev of rawFileStreamEvents) {
      files += 1;
      added += ev.addedLines ?? 0;
      removed += ev.removedLines ?? 0;
    }
    if (files === 0) return null;
    return { files, added, removed };
  }, [rawFileStreamEvents]);

  const currentNarrationLine = React.useMemo(() => {
    const narr = merged.filter(
      (e) => e.category === "assistant_message" && !isHeartbeatNarration(e),
    );
    const last = narr[narr.length - 1];
    if (!last) return undefined;
    return sanitizeUserBuildChatText(last.subtitle ?? last.title) || undefined;
  }, [merged]);

  const narrationTimeline = React.useMemo(() => {
    const seen = new Set<string>();
    const lines: string[] = [];
    for (const ev of merged) {
      if (ev.category !== "assistant_message" || isHeartbeatNarration(ev)) continue;
      const text = sanitizeUserBuildChatText(ev.subtitle ?? ev.title);
      if (!text || seen.has(text)) continue;
      seen.add(text);
      lines.push(text);
    }
    return lines;
  }, [merged]);

  const diagnosticsNarrationCopy = React.useMemo(() => {
    return merged
      .filter((e) => e.category === "assistant_message" && !isHeartbeatNarration(e))
      .map((e) => sanitizeUserBuildChatText(e.subtitle ?? e.title))
      .filter(Boolean)
      .join("\n");
  }, [merged]);

  const fileSummaryLine = fileDiffSummary
    ? `Generated ${fileDiffSummary.files} file${fileDiffSummary.files === 1 ? "" : "s"}`
    : "";

  const buildPhase = deriveBuildPhaseFromEvents(progress.events ?? []);
  const elapsedMs = now - startedAt;
  const lastMeta = progress.latest?.metadata ?? {};
  const chunkProgressLine = React.useMemo(() => {
    for (let i = (progress.events ?? []).length - 1; i >= 0; i--) {
      const m = progress.events![i]!.metadata as Record<string, unknown> | undefined;
      if (typeof m?.chunk_progress_line === "string") return m.chunk_progress_line;
    }
    return typeof lastMeta.chunk_progress_line === "string" ? lastMeta.chunk_progress_line : undefined;
  }, [progress.events, lastMeta.chunk_progress_line]);
  const activeWorkLine =
    typeof lastMeta.active_work === "string" && lastMeta.heartbeat === true
      ? (progress.latest?.title ?? progress.latest?.detail ?? undefined)
      : undefined;
  const finalSummaryLine = !working
    ? [...(progress.events ?? [])]
        .reverse()
        .find((e) => /build complete|build saved|build blocked|attempts:/i.test(e.title ?? ""))
        ?.title
    : null;

  const isBuildPaused =
    working &&
    (terminalMeta.continuing_generation_needed === true ||
      /generation paused/i.test(currentNarrationLine ?? ""));

  const showNoFilesYet =
    working &&
    elapsedMs >= NO_FILES_YET_THRESHOLD_MS &&
    rawFileStreamEvents.length === 0 &&
    streamFileCount < 1;

  const activeWorkChipLine =
    activeWorkLine ??
    (chunkProgressLine ? undefined : currentNarrationLine?.split("\n")[0]);

  const completedChunkIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const ev of progress.events ?? []) {
      const m = ev.metadata as Record<string, unknown> | undefined;
      if (m?.chunk_complete === true && typeof m.generation_chunk_id === "string") {
        ids.add(m.generation_chunk_id);
      }
    }
    return ids;
  }, [progress.events]);

  const buildHardTimeoutMs = BUILD_USER_TIMEOUT_MS;
  const buildElapsedStalled = working && elapsedMs > buildHardTimeoutMs;

  const ephemeralActionLine =
    activeWorkLine ??
    chunkProgressLine ??
    (working && narrationTimeline.length === 0 ? currentNarrationLine : undefined);

  const interleavedDisplay = React.useMemo(
    () => buildInterleavedWorkflowDisplay({ merged, working }),
    [merged, working],
  );

  const revealedCommitted = useSequentialWorkflowReveal(
    interleavedDisplay.committed,
    working,
    380,
  );

  const interleavedTick =
    interleavedDisplay.committed.length +
    (interleavedDisplay.liveNarration ? 1 : 0) +
    rawFileStreamEvents.length;

  const phaseHeartbeatLine = buildStepHeartbeatLine({
    phase: buildPhase,
    working,
    elapsedMs: now - startedAt,
    chunkProgress: chunkProgressLine,
    ephemeralLine: ephemeralActionLine,
  });

  const userStopped =
    progress.status === "cancelled" ||
    progress.latest?.metadata?.user_stopped === true ||
    progress.latest?.metadata?.version_status === "stopped_partial";

  const activeLiveFiles = React.useMemo(
    () =>
      rawFileStreamEvents
        .filter((e) => e.status === "active")
        .slice(-MAX_ACTIVE_FILE_ROWS),
    [rawFileStreamEvents],
  );
  const activeLivePathKeys = React.useMemo(
    () =>
      new Set(
        activeLiveFiles
          .map((e) => e.filePath?.replace(/\\/g, "/").toLowerCase())
          .filter(Boolean) as string[],
      ),
    [activeLiveFiles],
  );

  const buildFinalSummaryText = React.useMemo(() => {
    if (working) return null;
    for (let i = (progress.events ?? []).length - 1; i >= 0; i--) {
      const m = progress.events![i]!.metadata as Record<string, unknown> | undefined;
      if (typeof m?.build_final_summary === "string" && m.build_final_summary.trim()) {
        return sanitizeUserBuildChatText(m.build_final_summary);
      }
    }
    const terminal = interleavedDisplay.terminalNarration ?? finalSummaryLine;
    return terminal ? sanitizeUserBuildChatText(terminal) : null;
  }, [working, progress.events, interleavedDisplay.terminalNarration, finalSummaryLine]);

  const showPhaseChip =
    working &&
    !userStopped &&
    !interleavedDisplay.liveNarration &&
    activeLiveFiles.length === 0 &&
    (buildPhase === "planning" ||
      buildPhase === "pending" ||
      buildPhase === "extracting_files" ||
      buildPhase === "validating_quality" ||
      (buildPhase === "model_generating" &&
        interleavedDisplay.committed.filter((i) => i.kind === "file").length === 0));

  const fileEventMap = React.useMemo(() => {
    const map = new Map<string, AgentWorkflowEvent>();
    for (const ev of timeline) {
      if (isFileEvent(ev) && ev.filePath) {
        map.set(ev.filePath.replace(/\\/g, "/").toLowerCase(), ev);
      }
    }
    return map;
  }, [timeline]);

  return (
    <DreamOSMessageShell
      mode="build"
      status={working ? "thinking" : "done"}
      costState={working ? "pending" : "idle"}
      messageTextForCopy={
        [diagnosticsNarrationCopy, fileSummaryLine].filter(Boolean).join("\n\n") || userPrompt
      }
      className={className}
    >
    <div className="space-y-2.5" data-testid="agent-workflow-stream">
      {progress.reconnecting ? (
        <p className="px-1 text-[10px] text-muted-foreground">Reconnecting to build status…</p>
      ) : null}

      {showAnalyzing ? <AnalyzingRequestBubble /> : null}

      {(revealedCommitted.length > 0 || interleavedDisplay.liveNarration || working) ? (
        <div className="space-y-2 overflow-visible" data-testid="workflow-interleaved-stream">
          {revealedCommitted.map((item) => {
            if (item.kind === "narration") {
              return <NarrationLine key={item.key} text={item.text} />;
            }
            const pathKey = item.event.filePath?.replace(/\\/g, "/").toLowerCase();
            if (pathKey && activeLivePathKeys.has(pathKey)) return null;
            const focused = fileEventMap.get(pathKey ?? "") ?? item.event;
            return (
              <div key={item.event.stableKey} className="overflow-visible">
                <FileChangeCard event={focused} />
              </div>
            );
          })}
          {interleavedDisplay.liveNarration ? (
            <NarrationLine key="live-narration" text={interleavedDisplay.liveNarration} />
          ) : null}
        </div>
      ) : null}

      {working && (userStopped || isBuildPaused) ? (
        <BuildStepPhaseCard
          phase={buildPhase}
          working={working}
          paused
          hasFiles={rawFileStreamEvents.length > 0 || streamFileCount > 0}
          statusLine={
            userStopped
              ? "Prompt stopped. Saved progress is kept."
              : "Build paused — saved files are preserved."
          }
          chunkProgress={chunkProgressLine}
        />
      ) : working && showPhaseChip ? (
        <BuildStepPhaseCard
          phase={buildPhase}
          working={working}
          paused={false}
          hasFiles={rawFileStreamEvents.length > 0 || streamFileCount > 0}
          statusLine={phaseHeartbeatLine}
          chunkProgress={chunkProgressLine}
        />
      ) : null}

      {buildElapsedStalled ? <BuildNoFilesYetCard variant="hard_timeout" /> : null}

      {working
        ? activeLiveFiles.map((ev) => (
            <div key={`live-${ev.stableKey}`} className="overflow-visible">
              <FileChangeCard event={ev} />
            </div>
          ))
        : null}

      {!working && buildFinalSummaryText ? (
        <BuildFinalSummaryBlock summary={buildFinalSummaryText} />
      ) : null}

      {!working && (failed || !previewSucceeded) && projectId ? (
        <BuildFailureDiagnosticsInline
          projectId={projectId}
          jobId={progress.jobId}
          headline={
            previewSucceeded
              ? undefined
              : "Preview did not load — copy the full diagnostic for Cursor"
          }
        />
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
