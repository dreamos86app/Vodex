export const PREVIEW_FAILURE_CODES = [
  "missing_root_page",
  "missing_layout",
  "invalid_import",
  "package_missing",
  "compile_error",
  "runtime_exception",
  "preview_timeout",
  "empty_preview_html",
  "route_not_found",
  "source_integrity_failed",
  "unknown_preview_failure",
] as const;

export type PreviewFailureCode = (typeof PREVIEW_FAILURE_CODES)[number];

export type PreviewFailureDiagnostic = {
  code: PreviewFailureCode;
  message: string;
  userMessage: string;
  technicalDetail?: string;
  repairEligible: boolean;
  metadata?: Record<string, unknown>;
};

const FRIENDLY: Record<PreviewFailureCode, string> = {
  missing_root_page: "The app is missing app/page.tsx — preview cannot render.",
  missing_layout: "The app is missing app/layout.tsx — preview cannot render.",
  invalid_import: "An import path could not be resolved.",
  package_missing: "A required package is missing from package.json.",
  compile_error: "The generated code did not compile for preview.",
  runtime_exception: "Preview crashed with a runtime error.",
  preview_timeout: "Preview took too long to render.",
  empty_preview_html: "Preview returned empty or unusable HTML.",
  route_not_found: "The preview route could not be found.",
  source_integrity_failed: "Saved files did not pass source integrity checks.",
  unknown_preview_failure: "Preview could not render for an unknown reason.",
};

export function isPreviewFailureCode(value: string): value is PreviewFailureCode {
  return (PREVIEW_FAILURE_CODES as readonly string[]).includes(value);
}

export function userMessageForPreviewFailure(code: PreviewFailureCode): string {
  return FRIENDLY[code] ?? FRIENDLY.unknown_preview_failure;
}

export function classifyPreviewFailure(input: {
  html?: string;
  htmlLength?: number;
  hasRootElement?: boolean;
  missingImports?: string[];
  compileError?: string | null;
  runtimeError?: string | null;
  timedOut?: boolean;
  routeNotFound?: boolean;
  sourceIntegrityOk?: boolean;
  blockedReason?: string | null;
  packageError?: string | null;
}): PreviewFailureDiagnostic {
  const reason = (input.blockedReason ?? "").toLowerCase();
  const compile = (input.compileError ?? "").toLowerCase();
  const runtime = (input.runtimeError ?? "").toLowerCase();

  if (input.timedOut) {
    return diag("preview_timeout", input.runtimeError ?? undefined);
  }
  if (input.routeNotFound) {
    return diag("route_not_found", input.runtimeError ?? undefined);
  }
  if (reason.includes("missing_root_page") || reason.includes("missing app/page")) {
    return diag("missing_root_page", input.blockedReason ?? undefined, true);
  }
  if (reason.includes("missing_layout") || reason.includes("app/layout")) {
    return diag("missing_layout", input.blockedReason ?? undefined, true);
  }
  if ((input.missingImports?.length ?? 0) > 0) {
    return diag("invalid_import", input.missingImports!.join(", "), true);
  }
  if (input.packageError || reason.includes("package") || compile.includes("cannot find module")) {
    return diag("package_missing", input.packageError ?? compile, true);
  }
  if (compile.length > 0) {
    return diag("compile_error", input.compileError ?? undefined, true);
  }
  if (runtime.length > 0) {
    return diag("runtime_exception", input.runtimeError ?? undefined);
  }
  if (
    input.hasRootElement === false ||
    (input.htmlLength != null && input.htmlLength < 400) ||
    /no renderable content/i.test(input.html ?? "")
  ) {
    return diag("empty_preview_html", input.blockedReason ?? undefined, true);
  }
  if (input.sourceIntegrityOk === false) {
    return diag("source_integrity_failed", input.blockedReason ?? undefined, true);
  }

  return diag("unknown_preview_failure", input.blockedReason ?? undefined);
}

function diag(
  code: PreviewFailureCode,
  technicalDetail?: string,
  repairEligible = false,
): PreviewFailureDiagnostic {
  return {
    code,
    message: FRIENDLY[code],
    userMessage: FRIENDLY[code],
    technicalDetail,
    repairEligible,
    metadata: technicalDetail ? { technical_detail: technicalDetail } : undefined,
  };
}

export function mapLegacyPreviewErrorCode(code: string | undefined): PreviewFailureCode {
  if (!code) return "unknown_preview_failure";
  if (isPreviewFailureCode(code)) return code;
  if (code === "source_integrity_incomplete") return "source_integrity_failed";
  if (code === "preview_not_renderable") return "unknown_preview_failure";
  if (code === "empty_preview_html") return "empty_preview_html";
  return "unknown_preview_failure";
}
