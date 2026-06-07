/**
 * P1.3.11 — Single source of truth for terminal build UI copy.
 * Never show "Couldn't start the build" when recoverable files exist.
 */
import type { BuildJobEventRow } from "@/lib/build/build-job-events";
import { MIN_RENDERABLE_FILES } from "@/lib/build/build-success-contract";

export type BuildTerminalTruthState =
  | "build_failed_no_files"
  | "files_generated_saving"
  | "files_generated_not_saved"
  | "files_generated_preview_pending"
  | "files_generated_preview_repair"
  | "files_generated_needs_attention"
  | "build_complete_preview_ready";

export type BuildTerminalFailureKind =
  | "failed_before_generation"
  | "failed_after_generation"
  | "files_generated_preview_pending"
  | "files_generated_needs_save_repair"
  | "preview_failed"
  | "repair_needed"
  | null;

export type WorkflowFileSignals = {
  memoryFileCount: number;
  workflowFileCount: number;
  persistedSignalCount: number;
  hasWritingFileEvents: boolean;
  hasFilesInMemoryPhrase: boolean;
  hasSourceIntegrityCandidate: boolean;
  generationStarted: boolean;
  creditsRefunded: boolean;
};

export type ResolveBuildTerminalTruthInput = {
  workflowEvents?: BuildJobEventRow[];
  persistedFileCount?: number;
  memoryFileCount?: number;
  previewStatus?: string | null;
  previewRenderable?: boolean;
  failureKind?: string | null;
  sourceIntegrityOk?: boolean;
  previewFailed?: boolean;
  creditsRefunded?: boolean;
  persistenceConfirmed?: boolean;
};

export type BuildTerminalTruth = {
  state: BuildTerminalTruthState;
  headline: string;
  bodyLines: string[];
  effectiveFailureKind: BuildTerminalFailureKind;
  fileCount: number;
  memoryFileCount: number;
  persistedFileCount: number;
  hasRecoverableFiles: boolean;
  mayShowCatastrophicFailure: boolean;
  showRetrySave: boolean;
  showRepairActions: boolean;
  showPreviewActions: boolean;
  showRefundLine: boolean;
  signals: WorkflowFileSignals;
};

const CATASTROPHIC_HEADLINE = "Couldn't start the build";

export function extractWorkflowFileSignals(
  events: BuildJobEventRow[] = [],
): WorkflowFileSignals {
  let memoryFileCount = 0;
  let workflowFileCount = 0;
  let persistedSignalCount = 0;
  let hasWritingFileEvents = false;
  let hasFilesInMemoryPhrase = false;
  let hasSourceIntegrityCandidate = false;
  let generationStarted = false;

  for (const e of events) {
    const meta = e.metadata ?? {};
    const detail = e.detail ?? "";

    if (e.type === "writing_file" || e.type === "editing_file") {
      hasWritingFileEvents = true;
      if (e.file_path) workflowFileCount += 1;
      generationStarted = true;
    }

    const memoryMatch = detail.match(/(\d+)\s+files in memory/i);
    if (memoryMatch) {
      hasFilesInMemoryPhrase = true;
      memoryFileCount = Math.max(memoryFileCount, Number(memoryMatch[1]));
    }

    const savedMatch = detail.match(/(\d+)\s+files (?:written|saved|verified)/i);
    if (savedMatch) {
      persistedSignalCount = Math.max(persistedSignalCount, Number(savedMatch[1]));
    }

    const metaCount =
      typeof meta.files_persisted === "number"
        ? meta.files_persisted
        : typeof meta.file_count === "number"
          ? meta.file_count
          : typeof meta.files_kept === "number"
            ? meta.files_kept
            : 0;
    if (metaCount > 0) {
      persistedSignalCount = Math.max(persistedSignalCount, metaCount);
    }

    if (
      e.type === "saving_files" ||
      e.type === "completed" ||
      meta.source_integrity_ok === true ||
      detail.includes("source integrity passed")
    ) {
      hasSourceIntegrityCandidate = true;
    }

    if (
      ["writing_file", "editing_file", "saving_files", "generating_app_identity"].includes(e.type)
    ) {
      generationStarted = true;
    }
  }

  workflowFileCount = Math.max(workflowFileCount, persistedSignalCount, memoryFileCount);

  return {
    memoryFileCount,
    workflowFileCount,
    persistedSignalCount,
    hasWritingFileEvents,
    hasFilesInMemoryPhrase,
    hasSourceIntegrityCandidate,
    generationStarted,
    creditsRefunded: events.some((e) => e.type === "refunded"),
  };
}

export function hasRecoverableBuildFiles(input: {
  persistedFileCount?: number;
  memoryFileCount?: number;
  signals?: WorkflowFileSignals;
}): boolean {
  const signals = input.signals;
  const persisted = input.persistedFileCount ?? signals?.persistedSignalCount ?? 0;
  const memory = input.memoryFileCount ?? signals?.memoryFileCount ?? 0;
  const workflow = signals?.workflowFileCount ?? 0;

  return (
    persisted >= MIN_RENDERABLE_FILES ||
    memory >= MIN_RENDERABLE_FILES ||
    workflow >= MIN_RENDERABLE_FILES ||
    Boolean(signals?.hasWritingFileEvents && workflow > 0) ||
    Boolean(signals?.hasFilesInMemoryPhrase && memory > 0) ||
    Boolean(signals?.hasSourceIntegrityCandidate && (persisted > 0 || workflow > 0))
  );
}

/** Never surface catastrophic copy when recoverable files exist. */
export function guardCatastrophicHeadline(headline: string, hasRecoverableFiles: boolean): string {
  if (!hasRecoverableFiles) return headline;
  if (/couldn'?t start the build/i.test(headline)) {
    return "Build saved — preparing preview…";
  }
  return headline;
}

export function resolveBuildTerminalTruth(
  input: ResolveBuildTerminalTruthInput,
): BuildTerminalTruth {
  const events = input.workflowEvents ?? [];
  const signals = extractWorkflowFileSignals(events);

  const persistedFileCount = Math.max(
    input.persistedFileCount ?? 0,
    signals.persistedSignalCount,
  );
  const memoryFileCount = Math.max(input.memoryFileCount ?? 0, signals.memoryFileCount);
  const fileCount = Math.max(persistedFileCount, memoryFileCount, signals.workflowFileCount);

  const recoverable = hasRecoverableBuildFiles({
    persistedFileCount,
    memoryFileCount,
    signals,
  });

  const persistenceConfirmed =
    input.persistenceConfirmed === true ||
    persistedFileCount >= MIN_RENDERABLE_FILES ||
    signals.hasSourceIntegrityCandidate;

  const previewRenderable = input.previewRenderable === true;
  const previewFailed = input.previewFailed === true || input.failureKind === "preview_failed";
  const creditsRefunded = input.creditsRefunded === true || signals.creditsRefunded;
  const integrityOk = input.sourceIntegrityOk !== false;

  let state: BuildTerminalTruthState;
  let effectiveFailureKind: BuildTerminalFailureKind = null;
  let showRetrySave = false;
  let showRepairActions = false;
  let showPreviewActions = false;
  let showRefundLine = creditsRefunded && !recoverable;

  if (!recoverable) {
    state = "build_failed_no_files";
    effectiveFailureKind = "failed_before_generation";
  } else if (memoryFileCount >= MIN_RENDERABLE_FILES && !persistenceConfirmed) {
    state = "files_generated_not_saved";
    effectiveFailureKind = "files_generated_needs_save_repair";
    showRetrySave = true;
    showRepairActions = true;
  } else if (previewRenderable && integrityOk) {
    state = "build_complete_preview_ready";
    effectiveFailureKind = null;
    showPreviewActions = true;
  } else if (persistenceConfirmed && previewFailed) {
    state = "files_generated_preview_repair";
    effectiveFailureKind = "preview_failed";
    showRepairActions = true;
    showPreviewActions = true;
  } else if (persistenceConfirmed && !previewRenderable) {
    if (previewFailed) {
      state = "files_generated_preview_repair";
      effectiveFailureKind = "preview_failed";
      showRepairActions = true;
      showPreviewActions = true;
    } else {
      const pending =
        input.previewStatus == null ||
        input.previewStatus === "not_started" ||
        input.previewStatus === "pending" ||
        input.previewStatus === "preparing";
      state = pending ? "files_generated_preview_pending" : "files_generated_preview_repair";
      effectiveFailureKind = pending ? "files_generated_preview_pending" : "preview_failed";
      showPreviewActions = true;
      if (!pending) showRepairActions = true;
    }
  } else if (recoverable && !persistenceConfirmed) {
    state = "files_generated_saving";
    effectiveFailureKind = "files_generated_preview_pending";
  } else if (!integrityOk) {
    state = "files_generated_needs_attention";
    effectiveFailureKind = "repair_needed";
    showRepairActions = true;
  } else {
    state = "files_generated_needs_attention";
    effectiveFailureKind = "failed_after_generation";
    showRepairActions = true;
  }

  if (
    input.failureKind === "failed_before_generation" &&
    recoverable &&
    state === "build_failed_no_files"
  ) {
    state = persistenceConfirmed ? "files_generated_preview_pending" : "files_generated_not_saved";
    effectiveFailureKind = persistenceConfirmed
      ? "files_generated_preview_pending"
      : "files_generated_needs_save_repair";
  }

  const copy = copyForTerminalTruthState(state, {
    fileCount,
    memoryFileCount,
    persistedFileCount,
    creditsRefunded: creditsRefunded && !recoverable,
  });

  return {
    state,
    headline: copy.headline,
    bodyLines: copy.bodyLines,
    effectiveFailureKind,
    fileCount,
    memoryFileCount,
    persistedFileCount,
    hasRecoverableFiles: recoverable,
    mayShowCatastrophicFailure: state === "build_failed_no_files",
    showRetrySave,
    showRepairActions,
    showPreviewActions,
    showRefundLine,
    signals,
  };
}

function copyForTerminalTruthState(
  state: BuildTerminalTruthState,
  opts: {
    fileCount: number;
    memoryFileCount: number;
    persistedFileCount: number;
    creditsRefunded: boolean;
  },
): { headline: string; bodyLines: string[] } {
  const savedLine =
    opts.persistedFileCount >= MIN_RENDERABLE_FILES
      ? `${opts.persistedFileCount} file${opts.persistedFileCount === 1 ? "" : "s"} saved to your project`
      : opts.memoryFileCount >= MIN_RENDERABLE_FILES
        ? `${opts.memoryFileCount} files generated in memory`
        : opts.fileCount > 0
          ? `${opts.fileCount} file${opts.fileCount === 1 ? "" : "s"} generated`
          : undefined;

  switch (state) {
    case "build_failed_no_files":
      return {
        headline: CATASTROPHIC_HEADLINE,
        bodyLines: [
          "No usable source files were created. Try again or simplify your prompt.",
          opts.creditsRefunded ? "No credits were charged." : "",
        ].filter(Boolean),
      };
    case "files_generated_saving":
      return {
        headline: "Build files generated — saving project…",
        bodyLines: [savedLine, "Your files are being written to the project."].filter(Boolean) as string[],
      };
    case "files_generated_not_saved":
      return {
        headline: "Files were generated but not saved yet",
        bodyLines: [
          savedLine,
          "Retry save or run repair to persist files before preview.",
        ].filter(Boolean) as string[],
      };
    case "files_generated_preview_pending":
      return {
        headline: "Build saved — preparing preview…",
        bodyLines: [savedLine, "Preview will open when the session is ready."].filter(Boolean) as string[],
      };
    case "files_generated_preview_repair":
      return {
        headline: "Build saved — preview needs repair",
        bodyLines: [savedLine, "Run preview repair or retry preview to continue."].filter(Boolean) as string[],
      };
    case "files_generated_needs_attention":
      return {
        headline: "Build needs attention — files are available",
        bodyLines: [savedLine, "Open code or run repair to finish the build."].filter(Boolean) as string[],
      };
    case "build_complete_preview_ready":
      return {
        headline: "Done — preview is ready",
        bodyLines: [savedLine, "Your app is ready to preview and publish."].filter(Boolean) as string[],
      };
    default:
      return {
        headline: "Build saved — preparing preview…",
        bodyLines: [savedLine].filter(Boolean) as string[],
      };
  }
}

/** Map terminal truth to workflow failed-event metadata failure_kind. */
export function truthFailureKindForPersist(truth: BuildTerminalTruth): string {
  if (truth.effectiveFailureKind) return truth.effectiveFailureKind;
  if (truth.hasRecoverableFiles) return "files_generated_preview_pending";
  return "failed_before_generation";
}
