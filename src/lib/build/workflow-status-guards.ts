import type { BuildJobEventRow, BuildJobEventType } from "@/lib/build/build-job-events";
import type { BuildJobPollState } from "@/hooks/use-build-job-progress";
import { MIN_RENDERABLE_FILES } from "@/lib/build/build-success-contract";
import {
  copyForCanonicalBuildState,
  mustNotShowBuildFailedHeadline,
  resolveCanonicalBuildState,
} from "@/lib/build/build-state-truth";

/** Facts computed before showing any terminal status card. */
export type BuildStatusFacts = {
  hasBuildJob: boolean;
  hasFiles: boolean;
  fileCount: number;
  hasPreviewSession: boolean;
  hasRepairAttempt: boolean;
  repairAttemptCount: number;
  creditsReserved: boolean;
  creditsCharged: boolean;
  creditsRefunded: boolean;
  partialBuild: boolean;
  terminalStatus: "completed" | "failed" | "partial" | null;
  buildStarted: boolean;
  generationStarted: boolean;
  generationCompleted: boolean;
  contractChecked: boolean;
  previewAttempted: boolean;
  failureKind:
    | "failed_before_generation"
    | "failed_after_generation"
    | "preview_failed"
    | "repair_needed"
    | "repair_failed"
    | null;
  previewFailed: boolean;
  previewFailureCode?: string | null;
};

export type WorkflowRunStatus =
  | "waiting_for_prompt"
  | "planning"
  | "generating_files"
  | "checking_files"
  | "preview_ready"
  | "partial_credit_stop"
  | "insufficient_credits_before_start"
  | "failed_before_generation"
  | "failed_after_generation"
  | "preview_failed"
  | "repair_needed"
  | "repair_failed"
  | "completed";

export type BuildRunSummaryResolved = {
  status: WorkflowRunStatus;
  headline: string;
  bodyLines: string[];
  showRefundLine: boolean;
  showRepairActions: boolean;
  showPreviewActions: boolean;
  variant: "completed" | "partial" | "failed";
};

const REPAIR_DETAIL_RE =
  /repair pass|needs repair|another repair|before preview|quality repair|ui quality|premium ui|weak_output|contract quality|missing_blueprint_routes|ui_quality_/i;

function eventFileCount(events: BuildJobEventRow[]): number {
  let max = 0;
  for (const e of events) {
    const meta = e.metadata ?? {};
    const n =
      typeof meta.files_persisted === "number"
        ? meta.files_persisted
        : typeof meta.file_count === "number"
          ? meta.file_count
          : typeof meta.files_kept === "number"
            ? meta.files_kept
            : 0;
    if (n > max) max = n;
    if (e.type === "writing_file" || e.type === "editing_file") {
      if (e.file_path) max = Math.max(max, 1);
    }
  }
  return max;
}

function hasRefundedEvent(events: BuildJobEventRow[]): boolean {
  return events.some((e) => e.type === "refunded");
}

function countRepairSignals(events: BuildJobEventRow[]): number {
  return events.filter(
    (e) =>
      e.type === "fixing_error" ||
      (e.metadata?.repair_pass === true) ||
      (typeof e.detail === "string" && REPAIR_DETAIL_RE.test(e.detail)),
  ).length;
}

export function deriveBuildStatusFacts(input: {
  terminal?: BuildJobPollState | null;
  projectFileCount?: number;
  creditsReserved?: boolean;
}): BuildStatusFacts {
  const terminal = input.terminal;
  const events = terminal?.events ?? [];
  const failureKindMeta = terminal?.latest?.metadata?.failure_kind;
  const previewFailedMeta =
    terminal?.latest?.metadata?.preview_failed === true ||
    events.some((e) => e.metadata?.preview_failed === true);
  const previewFailureCode =
    typeof terminal?.latest?.metadata?.preview_failure_code === "string"
      ? terminal.latest.metadata.preview_failure_code
      : events.find((e) => typeof e.metadata?.preview_failure_code === "string")?.metadata
          ?.preview_failure_code ?? null;
  const metaFileCount = eventFileCount(events);
  const terminalMetaCount =
    typeof terminal?.latest?.metadata?.file_count === "number"
      ? terminal.latest.metadata.file_count
      : typeof terminal?.latest?.metadata?.files_persisted === "number"
        ? terminal.latest.metadata.files_persisted
        : null;
  const fromProject = input.projectFileCount ?? 0;
  let fileCount = fromProject;
  if (terminal?.done && terminalMetaCount != null) {
    fileCount = Math.max(fromProject, terminalMetaCount);
  } else if (!terminal?.done) {
    fileCount = Math.max(fromProject, metaFileCount);
  }
  if (failureKindMeta === "failed_before_generation") {
    fileCount = Math.max(fromProject, metaFileCount, terminalMetaCount ?? 0);
  }
  const hasFiles = fileCount >= MIN_RENDERABLE_FILES || fileCount > 0;
  const partialBuild =
    terminal?.latest?.type === "partial_credit_stop" ||
    events.some((e) => e.type === "partial_credit_stop");
  const failed =
    terminal?.status === "failed" ||
    terminal?.latest?.type === "failed" ||
    events.some((e) => e.type === "failed");
  const completed =
    terminal?.status === "completed" ||
    terminal?.latest?.type === "completed" ||
    events.some((e) => e.type === "completed");

  const failureKind =
    typeof failureKindMeta === "string"
      ? (failureKindMeta as BuildStatusFacts["failureKind"])
      : null;

  const repairAttemptCount = countRepairSignals(events);
  const hasRepairAttempt = repairAttemptCount > 0;

  const generationStarted = events.some((e) =>
    ["writing_file", "editing_file", "saving_files", "generating_app_identity", "validating"].includes(
      e.type,
    ),
  ) || events.some((e) => typeof e.metadata?.output_tokens === "number" && e.metadata.output_tokens > 0);

  let resolvedFailureKind = failureKind;
  if (previewFailedMeta && hasFiles) {
    resolvedFailureKind = "preview_failed";
  }
  if (failed && !partialBuild) {
    if (previewFailedMeta && hasFiles) {
      resolvedFailureKind = "preview_failed";
    } else if (!hasFiles && repairAttemptCount === 0) {
      resolvedFailureKind = "failed_before_generation";
    } else if (
      resolvedFailureKind === "repair_needed" ||
      (hasFiles && REPAIR_DETAIL_RE.test(terminal?.latest?.detail ?? terminal?.error ?? ""))
    ) {
      resolvedFailureKind = hasRepairAttempt ? "repair_needed" : "failed_after_generation";
    } else if (!resolvedFailureKind) {
      resolvedFailureKind = hasFiles ? "failed_after_generation" : "failed_before_generation";
    }
  }

  return {
    hasBuildJob: Boolean(terminal?.jobId),
    hasFiles,
    fileCount,
    hasPreviewSession: completed || events.some((e) => e.type === "preparing_preview"),
    hasRepairAttempt,
    repairAttemptCount,
    creditsReserved: Boolean(input.creditsReserved),
    creditsCharged: events.some(
      (e) => typeof e.metadata?.credits_charged === "number" && e.metadata.credits_charged > 0,
    ),
    creditsRefunded: hasRefundedEvent(events),
    partialBuild,
    terminalStatus: partialBuild ? "partial" : failed ? "failed" : completed ? "completed" : null,
    buildStarted: events.length > 0,
    generationStarted,
    generationCompleted:
      events.some((e) => e.type === "saving_files" || e.type === "completed") ||
      events.filter((e) => e.type === "writing_file" || e.type === "editing_file").length >= 3,
    contractChecked: events.some((e) => e.type === "checking_file" || e.type === "validating_preview"),
    previewAttempted: events.some((e) =>
      ["preparing_preview", "validating_preview", "completed"].includes(e.type),
    ),
    failureKind: resolvedFailureKind,
    previewFailed: previewFailedMeta,
    previewFailureCode: typeof previewFailureCode === "string" ? previewFailureCode : null,
  };
}

export function resolveWorkflowRunStatus(facts: BuildStatusFacts): WorkflowRunStatus {
  if (facts.partialBuild) return "partial_credit_stop";
  if (facts.terminalStatus === "completed") return "completed";
  if (facts.hasFiles && facts.failureKind === "failed_before_generation") {
    return facts.generationStarted || facts.generationCompleted
      ? "repair_needed"
      : facts.hasRepairAttempt
        ? "repair_needed"
        : "failed_after_generation";
  }
  if (facts.failureKind === "failed_before_generation" && (facts.generationStarted || facts.generationCompleted)) {
    return facts.hasFiles ? "repair_needed" : "failed_before_generation";
  }
  if (facts.failureKind === "failed_before_generation") return "failed_before_generation";
  if (facts.failureKind === "preview_failed" && facts.hasFiles) return "preview_failed";
  if (facts.failureKind === "repair_failed") return "repair_failed";
  if (facts.failureKind === "repair_needed" && facts.hasFiles) return "repair_needed";
  if (facts.terminalStatus === "failed" && facts.hasFiles) return "failed_after_generation";
  if (facts.terminalStatus === "failed") return "failed_before_generation";
  if (facts.generationStarted) return "generating_files";
  if (facts.buildStarted) return "planning";
  return "waiting_for_prompt";
}

export function resolveBuildRunSummary(input: {
  facts: BuildStatusFacts;
  appName?: string;
  filesCount?: number;
  pages?: string[];
  previewReady?: boolean;
  uiRichnessPasses?: boolean;
  sourceIntegrityOk?: boolean;
  creditsUsed?: number;
  errorDetail?: string;
}): BuildRunSummaryResolved {
  const filesCount = input.filesCount ?? input.facts.fileCount;

  const copy: Record<WorkflowRunStatus, { headline: string; bodyLines: string[] }> = {
    waiting_for_prompt: {
      headline: "Describe what you want to build",
      bodyLines: [],
    },
    planning: {
      headline: "Planning your app…",
      bodyLines: [],
    },
    generating_files: {
      headline: "Writing files…",
      bodyLines: [],
    },
    checking_files: {
      headline: "Checking files…",
      bodyLines: [],
    },
    preview_ready: {
      headline: "Preview is ready",
      bodyLines: [],
    },
    partial_credit_stop: {
      headline: "Partial progress saved",
      bodyLines: [
        "I used your remaining Build Credits and saved progress. Add credits to continue.",
        typeof input.creditsUsed === "number"
          ? `Used ${input.creditsUsed} Build Credit${input.creditsUsed === 1 ? "" : "s"} on this pass.`
          : "",
      ].filter(Boolean),
    },
    insufficient_credits_before_start: {
      headline: "You're out of Build Credits",
      bodyLines: ["Add credits or upgrade to keep building."],
    },
    failed_before_generation: {
      headline: input.facts.hasFiles ? "App files were created, but preview needs attention" : "Couldn't start the build",
      bodyLines: input.facts.hasFiles
        ? [
            input.errorDetail && !REPAIR_DETAIL_RE.test(input.errorDetail)
              ? input.errorDetail
              : "Your files were saved. Preview is still warming — retry preview or repair if it does not load.",
            input.facts.creditsRefunded ? "Credits were returned for this attempt." : "",
          ].filter(Boolean)
        : [
            input.errorDetail ?? "Please try again or adjust your request.",
            input.facts.creditsRefunded
              ? "Credits were returned for this attempt."
              : "No credits were charged.",
          ],
    },
    failed_after_generation: {
      headline: input.facts.hasFiles ? "Source files saved — needs attention" : "Build needs attention",
      bodyLines: [
        input.errorDetail && !REPAIR_DETAIL_RE.test(input.errorDetail)
          ? input.errorDetail
          : input.facts.hasFiles
            ? "App files were created. Run repair if source integrity checks failed."
            : "Generation did not complete successfully.",
        input.facts.creditsRefunded ? "Credits were returned for this attempt." : "",
      ].filter(Boolean),
    },
    preview_failed: {
      headline: "App files were created, but preview needs attention",
      bodyLines: [
        input.errorDetail && !REPAIR_DETAIL_RE.test(input.errorDetail)
          ? input.errorDetail
          : input.facts.previewFailureCode
            ? `Preview issue: ${String(input.facts.previewFailureCode).replace(/_/g, " ")}`
            : "Your source files are saved. Preview rendering failed — retry preview or run repair.",
        input.facts.creditsRefunded ? "Credits were returned for this attempt." : "",
      ].filter(Boolean),
    },
    repair_needed: {
      headline: "Build needs attention",
      bodyLines: [
        input.errorDetail && !REPAIR_DETAIL_RE.test(input.errorDetail)
          ? input.errorDetail
          : /todo|stub|incomplete/i.test(input.errorDetail ?? "")
            ? "Some source files were incomplete. Run repair to finish them."
            : "Files saved — preview render failed. Retry preview or run repair.",
      ],
    },
    repair_failed: {
      headline: "Repair did not fully complete",
      bodyLines: [
        "Your files were saved, and you can try another repair.",
        input.facts.creditsRefunded ? "Credits were returned for this attempt." : "",
      ].filter(Boolean),
    },
    completed: {
      headline: "Done — preview is ready",
      bodyLines: [
        "Preview is live with populated dashboard sections.",
        typeof filesCount === "number" && filesCount > 0
          ? `${filesCount} file${filesCount === 1 ? "" : "s"} created or updated`
          : "",
        input.pages?.length ? `Screens: ${input.pages.slice(0, 5).join(", ")}` : "",
      ].filter(Boolean),
    },
  };

  let status = resolveWorkflowRunStatus(input.facts);
  const savedFilesOk = filesCount >= MIN_RENDERABLE_FILES && input.facts.hasFiles;
  const firstPass = input.facts.repairAttemptCount === 0;

  if (input.previewReady && (status === "failed_before_generation" || status === "failed_after_generation")) {
    status = input.facts.failureKind === "repair_needed" && !firstPass ? "repair_needed" : "completed";
  }
  if (input.facts.previewFailed && savedFilesOk && input.previewReady !== true) {
    status = "preview_failed";
  } else if (input.facts.hasFiles && status === "failed_before_generation") {
    status = firstPass && savedFilesOk ? "failed_after_generation" : "failed_after_generation";
  }

  const integrityOk = input.sourceIntegrityOk !== false;
  const canShowSuccess = integrityOk && input.previewReady === true;

  if (
    savedFilesOk &&
    canShowSuccess &&
    (status === "failed_after_generation" || status === "repair_needed")
  ) {
    const cosmeticOnly =
      !input.errorDetail || REPAIR_DETAIL_RE.test(input.errorDetail);
    if (cosmeticOnly) {
      status = "completed";
    }
  }

  if (savedFilesOk && canShowSuccess && status === "failed_before_generation") {
    status = "completed";
  }

  if (status === "completed" && !canShowSuccess) {
    status = input.facts.previewFailed && savedFilesOk
      ? "preview_failed"
      : savedFilesOk
        ? "failed_after_generation"
        : "failed_before_generation";
  }

  if (input.facts.previewFailed && savedFilesOk && !input.previewReady) {
    status = "preview_failed";
  }
  let showRefundLine = input.facts.creditsRefunded;
  let showRepairActions =
    status === "repair_failed" ||
    status === "preview_failed" ||
    (status === "repair_needed" && input.facts.repairAttemptCount > 1);
  let showPreviewActions =
    status === "completed" || status === "preview_ready" || status === "preview_failed";

  if (savedFilesOk && firstPass && status === "completed") {
    showRepairActions = false;
    showRefundLine = false;
    showPreviewActions = true;
  }
  if (savedFilesOk && filesCount >= MIN_RENDERABLE_FILES) {
    showRefundLine = false;
  }
  if (input.facts.generationCompleted || input.facts.generationStarted) {
    if (status === "failed_before_generation" && savedFilesOk) {
      status = input.facts.previewFailed ? "preview_failed" : "repair_needed";
    }
  }
  if (!input.facts.creditsRefunded) {
    showRefundLine = false;
  }

  const block = copy[status] ?? copy.preview_failed;
  const canonical = resolveCanonicalBuildState({
    fileCount: filesCount,
    sourceIntegrityOk: input.sourceIntegrityOk,
    previewReady: input.previewReady === true,
    previewFailed: input.facts.previewFailed,
    previewPending: savedFilesOk && input.previewReady !== true && !input.facts.previewFailed,
    queuedNextSteps: input.uiRichnessPasses === false && savedFilesOk,
    runtimeFailed: status === "failed_before_generation" && !savedFilesOk,
  });
  const canonicalCopy = copyForCanonicalBuildState(canonical, {
    appName: input.appName,
    fileCount: filesCount,
  });

  let headline = mustNotShowBuildFailedHeadline(savedFilesOk, block.headline);
  let bodyLines = block.bodyLines;

  if (savedFilesOk && status !== "completed" && status !== "preview_ready") {
    headline = canonicalCopy.headline;
    bodyLines = canonicalCopy.bodyLines;
  }
  if (savedFilesOk && /draft saved.*additional generation needed/i.test(headline)) {
    headline = canonicalCopy.headline;
    bodyLines = canonicalCopy.bodyLines;
  }

  const variant: BuildRunSummaryResolved["variant"] =
    status === "completed" || status === "preview_ready"
      ? "completed"
      : status === "partial_credit_stop"
        ? "partial"
        : savedFilesOk
          ? "partial"
          : "failed";

  return {
    status,
    headline,
    bodyLines,
    showRefundLine,
    showRepairActions,
    showPreviewActions,
    variant: status === "partial_credit_stop" ? "partial" : variant === "completed" ? "completed" : "failed",
  };
}

/** Guard: repair copy must not appear when no files exist. */
export function assertNoRepairCopyBeforeFiles(
  facts: BuildStatusFacts,
  copy: string,
): boolean {
  if (facts.fileCount > 0 || facts.hasFiles) return true;
  return !REPAIR_DETAIL_RE.test(copy);
}

/** Guard: refund copy only when refund actually occurred. */
export function assertRefundCopyAllowed(facts: BuildStatusFacts, showRefund: boolean): boolean {
  if (!showRefund) return true;
  return facts.creditsRefunded;
}

export function failureKindForPersist(input: {
  fileCount: number;
  repairAttempted: boolean;
  previewFailedWithFiles?: boolean;
  technicalOnly?: boolean;
}): NonNullable<BuildStatusFacts["failureKind"]> {
  if (input.fileCount <= 0) return "failed_before_generation";
  if (input.previewFailedWithFiles) return "preview_failed";
  if (input.repairAttempted && input.technicalOnly) return "repair_needed";
  return "failed_after_generation";
}

export function userSafeFailureTitle(
  kind: NonNullable<BuildStatusFacts["failureKind"]>,
  hasFiles = false,
): string {
  if (hasFiles && kind === "failed_before_generation") {
    return "Build saved — preview is being prepared";
  }
  switch (kind) {
    case "failed_before_generation":
      return "Couldn't start the build";
    case "failed_after_generation":
      return "Source files saved — needs attention";
    case "preview_failed":
      return "App files were created, but preview needs attention";
    case "repair_needed":
      return "Build needs attention";
    case "repair_failed":
      return "Repair did not fully complete";
    default:
      return "Build stopped";
  }
}

export function userSafeFailureDetail(
  kind: NonNullable<BuildStatusFacts["failureKind"]>,
  raw?: string,
): string {
  if (kind === "failed_before_generation") {
    return "I couldn't generate files for this request. Try again or simplify your prompt.";
  }
  if (raw && !REPAIR_DETAIL_RE.test(raw)) return raw;
  if (kind === "preview_failed") {
    return "Your source files are saved. Preview rendering failed — use retry preview or repair for the exact issue.";
  }
  if (kind === "repair_needed" || kind === "failed_after_generation") {
    return "Source files were saved, but additional repair is required before preview can run.";
  }
  return raw ?? "Something went wrong during the build.";
}

export function mapActivePhaseFromJobType(type: BuildJobEventType | null): string {
  const map: Partial<Record<BuildJobEventType, string>> = {
    understanding_request: "Understanding the request",
    planning_app: "Designing the app structure",
    generating_app_identity: "Creating name and icon",
    generating_app_icon: "Creating app icon",
    writing_file: "Writing files",
    editing_file: "Editing files",
    checking_file: "Checking quality",
    fixing_error: "Fixing issues",
    validating_preview: "Checking preview",
    saving_files: "Saving files",
    preparing_preview: "Preparing preview",
  };
  return (type && map[type]) || "Working";
}
