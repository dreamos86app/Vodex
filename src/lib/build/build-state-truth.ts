/**
 * P1.3.9 — Canonical build terminal states for user-facing copy.
 */
import { MIN_RENDERABLE_FILES } from "@/lib/build/build-success-contract";

export type CanonicalBuildState =
  | "build_failed_no_files"
  | "files_saved_preview_pending"
  | "files_saved_preview_failed"
  | "files_saved_preview_repair_needed"
  | "build_complete_preview_ready"
  | "build_failed_integrity"
  | "build_failed_runtime"
  | "build_queued_next_steps";

export type BuildStateCopy = {
  state: CanonicalBuildState;
  headline: string;
  bodyLines: string[];
  healthSeverity: "ok" | "warning" | "critical";
};

const BUILD_PLAN_RE =
  /# Build execution plan|execution plan \(compressed\)|compressed\)|build execution plan/i;

export function isInternalBuildPlanText(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  return BUILD_PLAN_RE.test(text) || text.includes("Purpose:") && text.includes("Routes:");
}

export function resolveCanonicalBuildState(input: {
  fileCount: number;
  sourceIntegrityOk?: boolean;
  previewReady?: boolean;
  previewFailed?: boolean;
  previewPending?: boolean;
  queuedNextSteps?: boolean;
  runtimeFailed?: boolean;
}): CanonicalBuildState {
  const hasFiles = input.fileCount >= MIN_RENDERABLE_FILES;
  if (!hasFiles) {
    if (input.runtimeFailed) return "build_failed_runtime";
    return "build_failed_no_files";
  }
  if (input.sourceIntegrityOk === false) return "build_failed_integrity";
  if (input.previewReady) return "build_complete_preview_ready";
  if (input.queuedNextSteps) return "build_queued_next_steps";
  if (input.previewFailed) return "files_saved_preview_failed";
  if (input.previewPending) return "files_saved_preview_pending";
  return "files_saved_preview_repair_needed";
}

export function copyForCanonicalBuildState(
  state: CanonicalBuildState,
  opts?: { appName?: string; fileCount?: number },
): BuildStateCopy {
  const n = opts?.fileCount ?? 0;
  const filesLine =
    n > 0 ? `${n} file${n === 1 ? "" : "s"} saved to your project` : undefined;

  switch (state) {
    case "build_failed_no_files":
      return {
        state,
        headline: "Couldn't start the build",
        bodyLines: [
          "No usable source files were created. Try again or simplify your prompt.",
          "No credits were charged.",
        ],
        healthSeverity: "critical",
      };
    case "files_saved_preview_pending":
      return {
        state,
        headline: "Build saved — preview is being prepared",
        bodyLines: [filesLine, "Preview will open automatically when ready."].filter(Boolean) as string[],
        healthSeverity: "warning",
      };
    case "files_saved_preview_failed":
      return {
        state,
        headline: "Files were saved. Preview needs repair.",
        bodyLines: [
          filesLine,
          "Use Run preview repair, Open code, or copy technical details from diagnostics.",
        ].filter(Boolean) as string[],
        healthSeverity: "warning",
      };
    case "files_saved_preview_repair_needed":
      return {
        state,
        headline: "Build saved — preview needs a technical fix",
        bodyLines: [filesLine, "Run repair or retry preview to continue."].filter(Boolean) as string[],
        healthSeverity: "warning",
      };
    case "build_complete_preview_ready":
      return {
        state,
        headline: "Done — preview is ready",
        bodyLines: [filesLine, "Your app is ready to preview and publish."].filter(Boolean) as string[],
        healthSeverity: "ok",
      };
    case "build_failed_integrity":
      return {
        state,
        headline: "Files were saved — source needs attention",
        bodyLines: [filesLine, "Some files failed integrity checks. Run repair before preview."].filter(
          Boolean,
        ) as string[],
        healthSeverity: "warning",
      };
    case "build_failed_runtime":
      return {
        state,
        headline: "Build stopped before files were saved",
        bodyLines: ["Generation crashed before persistence. Try again."],
        healthSeverity: "critical",
      };
    case "build_queued_next_steps":
      return {
        state,
        headline: "Build saved — next steps queued",
        bodyLines: [filesLine, "Remaining work is queued as follow-up steps."].filter(Boolean) as string[],
        healthSeverity: "warning",
      };
    default:
      return {
        state: "files_saved_preview_pending",
        headline: "Build saved — preview is being prepared",
        bodyLines: [filesLine].filter(Boolean) as string[],
        healthSeverity: "warning",
      };
  }
}

/** Never show catastrophic build-failed copy when files exist. */
export function mustNotShowBuildFailedHeadline(hasFiles: boolean, headline: string): string {
  if (!hasFiles) return headline;
  if (/couldn'?t start the build/i.test(headline)) {
    return "Build saved — preview is being prepared";
  }
  if (/draft saved.*additional generation needed/i.test(headline)) {
    return "Build saved — preview needs a technical fix";
  }
  return headline;
}
