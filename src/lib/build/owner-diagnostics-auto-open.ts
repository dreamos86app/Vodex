"use client";

const AUTO_OPEN_CODES = new Set([
  "missing_root_page",
  "missing_root_page_content",
  "technical_generation_incomplete",
  "preview_failed",
  "build_failed",
  "source_integrity_failed",
  "empty_preview_html",
]);

export function shouldAutoOpenOwnerDiagnostics(input: {
  failureCode?: string | null;
  blockedReason?: string | null;
  errorMessage?: string | null;
}): boolean {
  const code = (input.failureCode ?? "").toLowerCase();
  if (AUTO_OPEN_CODES.has(code)) return true;
  const reason = (input.blockedReason ?? input.errorMessage ?? "").toLowerCase();
  if (!reason) return false;
  if (reason.includes("missing_root_page")) return true;
  if (reason.includes("technical_generation_incomplete")) return true;
  if (reason.includes("preview_failed")) return true;
  if (reason.includes("build_failed")) return true;
  return false;
}
