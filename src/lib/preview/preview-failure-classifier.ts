/**
 * P1.3.15 — Precise preview build failure classification.
 */
import { MIN_RENDERABLE_FILES } from "@/lib/build/build-success-contract";
import { isSubstantialPreviewApp, type TodoStubMatch } from "@/lib/build/todo-stub-detector";
import { isNextSsrStaticExportBlocker } from "@/lib/imports/next-static-export-repair";
import {
  normalizePreviewBuildLogs,
  type NormalizedPreviewBuildLog,
} from "@/lib/preview/preview-build-log-normalizer";

export type PreviewBuildFailureKind =
  | "npm_install_failed"
  | "vite_build_failed"
  | "typescript_compile_failed"
  | "missing_import"
  | "missing_export"
  | "package_missing"
  | "unsupported_browser_api"
  | "invalid_next_or_vite_config"
  | "runtime_render_error"
  | "artifact_upload_failed"
  | "preview_timeout"
  | "true_incomplete_files"
  | "preview_source_validation_failed"
  | "preview_not_started_due_to_gate_bug"
  | "preview_build_failed";

export type PreviewFailureStage =
  | "install"
  | "build"
  | "compile"
  | "runtime"
  | "upload"
  | "source"
  | "unknown";

export type PreviewFailureClassification = {
  failure_kind: PreviewBuildFailureKind;
  failure_stage: PreviewFailureStage;
  failure_message: string;
  human_title: string;
  human_summary: string;
  suggested_repair_action: string;
  auto_repair_eligible: boolean;
  npm_error: string | null;
  vite_error: string | null;
  typescript_error: string | null;
  missing_imports: string[];
  missing_files: string[];
  invalid_exports: string[];
  unsupported_packages: string[];
  failing_file: string | null;
  failing_line: number | null;
  build_logs_tail: string[];
};

export const SUBSTANTIAL_APP_FILE_THRESHOLD = 25;

const TITLES: Record<PreviewBuildFailureKind, string> = {
  npm_install_failed: "Preview build failed — npm install",
  vite_build_failed: "Preview build failed — Vite",
  typescript_compile_failed: "Preview build failed — TypeScript",
  missing_import: "Preview build failed — missing import",
  missing_export: "Preview build failed — missing export",
  package_missing: "Preview build failed — package missing",
  unsupported_browser_api: "Preview build failed — unsupported API",
  invalid_next_or_vite_config: "Preview build failed — config error",
  runtime_render_error: "Preview runtime error",
  artifact_upload_failed: "Preview artifact upload failed",
  preview_timeout: "Preview build timed out",
  true_incomplete_files: "Generated files are incomplete",
  preview_source_validation_failed: "Preview blocked by source validation",
  preview_not_started_due_to_gate_bug: "Preview not started — gate bug",
  preview_build_failed: "Preview build failed",
};

export function isTrueIncompleteFiles(input: {
  appFilesCount: number;
  packageJsonExists: boolean;
  entrypointExists: boolean;
  sourceIntegrityOk?: boolean;
  meaningfulSourceFileCount?: number;
  mainRouteEmpty?: boolean;
}): boolean {
  if (input.appFilesCount < MIN_RENDERABLE_FILES) return true;
  if (!input.packageJsonExists) return true;
  if (!input.entrypointExists) return true;
  if (input.mainRouteEmpty) return true;
  if ((input.meaningfulSourceFileCount ?? 0) === 0 && input.appFilesCount < SUBSTANTIAL_APP_FILE_THRESHOLD) {
    return true;
  }
  if (input.appFilesCount >= SUBSTANTIAL_APP_FILE_THRESHOLD && input.packageJsonExists && input.entrypointExists) {
    return (input.meaningfulSourceFileCount ?? 0) === 0;
  }
  return input.sourceIntegrityOk === false;
}

export function whyUiSaysGeneratedFilesIncomplete(input: {
  classification: PreviewFailureClassification;
  appFilesCount: number;
  repairShowsIncompleteSource: boolean;
}): string {
  if (!input.repairShowsIncompleteSource) {
    return "Repair center does not show incomplete_source for this project.";
  }
  if (input.classification.failure_kind !== "true_incomplete_files") {
    return `Misclassified — ${input.appFilesCount} files exist; real kind is ${input.classification.failure_kind}, not true_incomplete_files.`;
  }
  return "Classifier agrees files are genuinely incomplete.";
}

export function classifyPreviewBuildFailure(input: {
  appFilesCount: number;
  routesCount: number;
  packageJsonExists: boolean;
  entrypointExists: boolean;
  previewArtifactExists: boolean;
  buildLogs?: string | null;
  errorCode?: string | null;
  blockedReason?: string | null;
  userMessage?: string | null;
  jobStatus?: string | null;
  previewStatus?: string | null;
  sourceIntegrityOk?: boolean;
  meaningfulSourceFileCount?: number;
  mainRouteEmpty?: boolean;
  timedOut?: boolean;
  previewBuildJobId?: string | null;
  hasBlockingTodoStub?: boolean;
  todoStubMatches?: TodoStubMatch[];
}): PreviewFailureClassification {
  const normalized = normalizePreviewBuildLogs(input.buildLogs);
  const reason = `${input.blockedReason ?? ""} ${input.userMessage ?? ""} ${input.errorCode ?? ""}`.toLowerCase();
  const noWorkerJob = !input.previewBuildJobId;
  const hasBlockingTodoStub =
    input.hasBlockingTodoStub ??
    (input.todoStubMatches?.some((m) => m.blocking) ?? false);
  const mentionsTodoStub = reason.includes("todo_or_stub");
  const substantialApp = isSubstantialPreviewApp({
    fileCount: input.appFilesCount,
    packageJsonExists: input.packageJsonExists,
    entrypointExists: input.entrypointExists,
    routeCount: input.routesCount,
  });
  const nonBlockingStubOnly =
    mentionsTodoStub && !hasBlockingTodoStub && substantialApp;
  const sourceValidationHit =
    (mentionsTodoStub && hasBlockingTodoStub) ||
    (!mentionsTodoStub &&
      (reason.includes("validation_failed") ||
        input.errorCode === "validation_failed" ||
        input.errorCode === "source_validation_failed"));

  if (noWorkerJob && nonBlockingStubOnly) {
    return buildClassification("preview_not_started_due_to_gate_bug", "source", {
      ...normalized,
      failure_message:
        "Secondary route placeholders were treated as blocking — retry preview to start the worker build.",
      suggested_repair: "Retry preview — only the primary route stub should block substantial apps.",
      auto_repair: false,
    });
  }

  if (noWorkerJob && sourceValidationHit) {
    const stubPath =
      reason.match(/todo_or_stub_page:([^\s;]+)/)?.[1] ??
      normalized.failing_file ??
      null;
    return buildClassification("preview_source_validation_failed", "source", {
      ...normalized,
      failure_message:
        stubPath != null
          ? `Source validation blocked preview — stub/TODO content in ${stubPath}`
          : (input.userMessage ?? input.blockedReason ?? "Preview blocked by source validation"),
      suggested_repair: stubPath
        ? `Open ${stubPath}, replace stub/TODO content with real UI, then retry preview.`
        : "Fix the reported source validation issue, then retry preview.",
      auto_repair: true,
      failing_file: stubPath,
    });
  }

  if (
    noWorkerJob &&
    (input.previewStatus === "failed" || input.jobStatus === "failed") &&
    !normalized.vite_error &&
    !normalized.typescript_error &&
    !normalized.npm_error &&
    !nonBlockingStubOnly
  ) {
    return buildClassification("preview_source_validation_failed", "source", {
      ...normalized,
      failure_message:
        input.userMessage ??
        input.blockedReason ??
        "Preview blocked before a worker build could start.",
      suggested_repair: "Resolve the source validation blocker, then start preview again.",
      auto_repair: true,
    });
  }

  if (
    isTrueIncompleteFiles({
      appFilesCount: input.appFilesCount,
      packageJsonExists: input.packageJsonExists,
      entrypointExists: input.entrypointExists,
      sourceIntegrityOk: input.sourceIntegrityOk,
      meaningfulSourceFileCount: input.meaningfulSourceFileCount,
      mainRouteEmpty: input.mainRouteEmpty,
    }) &&
    input.appFilesCount < SUBSTANTIAL_APP_FILE_THRESHOLD
  ) {
    return buildClassification("true_incomplete_files", "source", {
      ...normalized,
      failure_message:
        input.blockedReason ?? input.userMessage ?? "Source files are missing or too thin to render.",
      suggested_repair: "Generate missing routes and components — do not replace the app with a generic shell.",
      auto_repair: true,
    });
  }

  if (input.timedOut || reason.includes("timeout") || input.errorCode === "preview_timeout") {
    return buildClassification("preview_timeout", "build", {
      ...normalized,
      failure_message: input.userMessage ?? "Preview build timed out.",
      suggested_repair: "Retry preview or increase worker timeout.",
      auto_repair: false,
    });
  }

  if (normalized.npm_error || reason.includes("install failed") || input.errorCode === "INSTALL_FAILED") {
    return buildClassification("npm_install_failed", "install", {
      ...normalized,
      failure_message: normalized.npm_error ?? input.blockedReason ?? "npm install failed",
      suggested_repair: normalized.suggested_repair_action ?? "Fix package.json and dependencies.",
      auto_repair: true,
    });
  }

  if (normalized.missing_imports.length || reason.includes("invalid_import") || reason.includes("cannot find module")) {
    const aliasImport = normalized.missing_imports.some(
      (m) => m.startsWith("@/") || m.startsWith("~/") || m.startsWith("src/"),
    );
    const classification = buildClassification("missing_import", "compile", {
      ...normalized,
      failure_message:
        normalized.typescript_error ??
        `Missing import: ${normalized.missing_imports.slice(0, 3).join(", ")}`,
      suggested_repair: aliasImport
        ? "Add or repair tsconfig path aliases (@/*) — auto-repair can normalize imports before rebuild."
        : (normalized.suggested_repair_action ??
          "Add or fix imports in the failing file only — keep full app scope."),
      auto_repair: true,
    });
    if (aliasImport) {
      classification.human_title = "Preview build failed — missing tsconfig / path aliases";
      classification.human_summary =
        normalized.missing_imports[0] != null
          ? `Could not resolve path alias import: ${normalized.missing_imports[0]}`
          : classification.human_summary;
    }
    return classification;
  }

  if (normalized.invalid_exports.length || reason.includes("missing_export")) {
    return buildClassification("missing_export", "compile", {
      ...normalized,
      failure_message: `Missing export in ${normalized.invalid_exports.slice(0, 2).join(", ")}`,
      suggested_repair: "Export the symbol or fix the import path.",
      auto_repair: true,
    });
  }

  if (
    normalized.typescript_error ||
    reason.includes("compile") ||
    reason.includes("type error") ||
    input.errorCode === "compile_error"
  ) {
    return buildClassification("typescript_compile_failed", "compile", {
      ...normalized,
      failure_message: normalized.typescript_error ?? input.blockedReason ?? "TypeScript compile failed",
      suggested_repair:
        normalized.suggested_repair_action ??
        "Fix TypeScript errors in the reported file without removing routes.",
      auto_repair: true,
    });
  }

  if (
    normalized.vite_error ||
    reason.includes("vite") ||
    input.errorCode === "VITE_BUILD_OOM" ||
    reason.includes("rollup")
  ) {
    return buildClassification("vite_build_failed", "build", {
      ...normalized,
      failure_message: normalized.vite_error ?? input.blockedReason ?? "Vite build failed",
      suggested_repair: normalized.suggested_repair_action ?? "Fix the Vite build error in the failing module.",
      auto_repair: true,
    });
  }

  if (
    normalized.unsupported_packages.length ||
    reason.includes("package_missing") ||
    input.errorCode === "package_missing"
  ) {
    return buildClassification("package_missing", "install", {
      ...normalized,
      failure_message: `Missing package: ${normalized.unsupported_packages.slice(0, 3).join(", ")}`,
      suggested_repair: "Add the package to package.json dependencies.",
      auto_repair: true,
    });
  }

  if (reason.includes("vite.config") || reason.includes("next.config") || reason.includes("invalid config")) {
    return buildClassification("invalid_next_or_vite_config", "build", {
      ...normalized,
      failure_message: input.blockedReason ?? "Invalid framework config",
      suggested_repair: "Repair vite.config or next.config without removing app routes.",
      auto_repair: true,
    });
  }

  if (isNextSsrStaticExportBlocker(reason)) {
    return buildClassification("invalid_next_or_vite_config", "build", {
      ...normalized,
      failure_message:
        input.blockedReason ??
        input.userMessage ??
        "Next.js preview needs static export configuration.",
      suggested_repair:
        "Add output: 'export' to next.config and rebuild preview. Auto-repair can patch next.config without removing routes.",
      auto_repair: true,
    });
  }

  if (reason.includes("window.") || reason.includes("document.") || reason.includes("unsupported_browser")) {
    return buildClassification("unsupported_browser_api", "runtime", {
      ...normalized,
      failure_message: input.blockedReason ?? "Unsupported browser API in server context",
      suggested_repair: "Guard browser APIs with typeof window checks.",
      auto_repair: true,
    });
  }

  if (!input.previewArtifactExists && (input.jobStatus === "succeeded" || input.previewStatus === "ready")) {
    return buildClassification("artifact_upload_failed", "upload", {
      ...normalized,
      failure_message: "Preview build finished but artifact was not stored.",
      suggested_repair: "Retry preview build.",
      auto_repair: false,
    });
  }

  if (
    (reason.includes("runtime") || input.errorCode === "runtime_exception") &&
    !isNextSsrStaticExportBlocker(reason)
  ) {
    return buildClassification("runtime_render_error", "runtime", {
      ...normalized,
      failure_message: input.userMessage ?? input.blockedReason ?? "Preview runtime error",
      suggested_repair: "Fix the runtime error in the failing component.",
      auto_repair: true,
    });
  }

  return buildClassification("preview_build_failed", "unknown", {
    ...normalized,
    failure_message:
      input.userMessage ??
      input.blockedReason ??
      normalized.vite_error ??
      normalized.typescript_error ??
      "Preview build failed",
    suggested_repair:
      normalized.suggested_repair_action ??
      "Open build logs, fix the reported error, and retry preview.",
    auto_repair: Boolean(
      normalized.missing_imports.length ||
        normalized.typescript_error ||
        normalized.vite_error,
    ),
  });
}

function buildClassification(
  kind: PreviewBuildFailureKind,
  stage: PreviewFailureStage,
  input: NormalizedPreviewBuildLog & {
    failure_message: string;
    suggested_repair: string;
    auto_repair: boolean;
    failing_file?: string | null;
  },
): PreviewFailureClassification {
  return {
    failure_kind: kind,
    failure_stage: stage,
    failure_message: input.failure_message,
    human_title: TITLES[kind],
    human_summary: input.failure_message,
    suggested_repair_action: input.suggested_repair,
    auto_repair_eligible: input.auto_repair,
    npm_error: input.npm_error,
    vite_error: input.vite_error,
    typescript_error: input.typescript_error,
    missing_imports: input.missing_imports,
    missing_files: input.missing_files,
    invalid_exports: input.invalid_exports,
    unsupported_packages: input.unsupported_packages,
    failing_file: input.failing_file ?? null,
    failing_line: input.failing_line,
    build_logs_tail: input.build_logs_tail,
  };
}
