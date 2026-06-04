import type { BuildFile } from "@/lib/build/generated-file-utils";
import { evaluateSourceIntegrity } from "@/lib/build/source-integrity-validator";
import { truncateLargeDiagnosticString } from "@/lib/diagnostics/truncate-large-diagnostic-string";
import {
  classifyPreviewFailure,
  mapLegacyPreviewErrorCode,
  type PreviewFailureCode,
} from "@/lib/preview/preview-failure-codes";
import {
  detectBrokenPreviewSnapshot,
  isStaticPreviewHtmlHealthy,
} from "@/lib/preview/broken-preview-snapshot";
import { isViteSpaPreviewShell } from "@/lib/preview/vite-spa-preview-shell";

function truncatePreviewSnippet(html: string): string {
  return truncateLargeDiagnosticString(html, 2000);
}

export function isStaticPreviewSnapshotHealthy(
  html: string,
  sourceFileCount: number,
): boolean {
  return isStaticPreviewHtmlHealthy(html, sourceFileCount);
}

export { detectBrokenPreviewSnapshot };

export type PreviewHtmlDiagnostics = {
  htmlLength: number;
  hasRootElement: boolean;
  sourceFileCount: number;
  sourceIntegrityOk: boolean;
  previewRenderable: boolean;
  errorCode?: PreviewFailureCode;
  errorMessage?: string;
};

export function analyzePreviewHtml(
  html: string,
  files: BuildFile[],
  options?: { previewSessionOk?: boolean },
): PreviewHtmlDiagnostics {
  const htmlLength = html.length;
  const viteShell = isViteSpaPreviewShell(html);
  const hasRootElement = html.includes("generated-app-preview-root") || viteShell;
  const sourceFileCount = files.length;
  const integrity = evaluateSourceIntegrity(files, {
    previewHtmlLength: htmlLength,
    previewSessionOk: options?.previewSessionOk,
    previewHtmlSnippet: truncatePreviewSnippet(html),
  });

  const brokenSnapshot = detectBrokenPreviewSnapshot(html);
  const staticSnapshotHealthy =
    isStaticPreviewSnapshotHealthy(html, sourceFileCount) || viteShell;

  const hasFailure =
    brokenSnapshot.broken ||
    (!staticSnapshotHealthy &&
      !viteShell &&
      (!integrity.previewRenderable ||
        !integrity.sourceIntegrityOk ||
        !hasRootElement ||
        htmlLength < 400 ||
        /no renderable content/i.test(html)));

  let errorCode: PreviewFailureCode | undefined;
  let errorMessage: string | undefined;

  if (hasFailure) {
    const classified = classifyPreviewFailure({
      html,
      htmlLength,
      hasRootElement,
      sourceIntegrityOk: integrity.sourceIntegrityOk,
      blockedReason: integrity.blockedReason,
    });
    errorCode = brokenSnapshot.broken
      ? "preview_broken_static_snapshot"
      : !hasRootElement || htmlLength < 400 || /no renderable content/i.test(html)
        ? "empty_preview_html"
        : !integrity.sourceIntegrityOk
          ? mapLegacyPreviewErrorCode("source_integrity_incomplete")
          : classified.code;
    errorMessage = brokenSnapshot.broken
      ? `Preview HTML contains mangled fragments (${brokenSnapshot.reasons.join(", ")})`
      : classified.userMessage;
  }

  const previewRenderable =
    !brokenSnapshot.broken &&
    ((viteShell && htmlLength >= 120) ||
      (integrity.previewRenderable && !errorCode) ||
      (staticSnapshotHealthy && !errorCode));

  return {
    htmlLength,
    hasRootElement,
    sourceFileCount,
    sourceIntegrityOk: integrity.sourceIntegrityOk || staticSnapshotHealthy,
    previewRenderable,
    errorCode,
    errorMessage,
  };
}
