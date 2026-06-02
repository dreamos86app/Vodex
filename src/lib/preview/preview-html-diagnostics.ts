import type { BuildFile } from "@/lib/build/generated-file-utils";
import { evaluateSourceIntegrity } from "@/lib/build/source-integrity-validator";
import { truncateLargeDiagnosticString } from "@/lib/diagnostics/truncate-large-diagnostic-string";
import {
  classifyPreviewFailure,
  mapLegacyPreviewErrorCode,
  type PreviewFailureCode,
} from "@/lib/preview/preview-failure-codes";

function truncatePreviewSnippet(html: string): string {
  return truncateLargeDiagnosticString(html, 2000);
}

export function isStaticPreviewSnapshotHealthy(
  html: string,
  sourceFileCount: number,
): boolean {
  return (
    html.includes("generated-app-preview-root") &&
    html.length >= 800 &&
    !/no renderable content/i.test(html) &&
    sourceFileCount >= 4
  );
}

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
  const hasRootElement = html.includes("generated-app-preview-root");
  const sourceFileCount = files.length;
  const integrity = evaluateSourceIntegrity(files, {
    previewHtmlLength: htmlLength,
    previewSessionOk: options?.previewSessionOk,
    previewHtmlSnippet: truncatePreviewSnippet(html),
  });

  const staticSnapshotHealthy = isStaticPreviewSnapshotHealthy(html, sourceFileCount);

  const hasFailure =
    !staticSnapshotHealthy &&
    (!integrity.previewRenderable ||
      !integrity.sourceIntegrityOk ||
      !hasRootElement ||
      htmlLength < 400 ||
      /no renderable content/i.test(html));

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
    errorCode =
      !hasRootElement || htmlLength < 400 || /no renderable content/i.test(html)
        ? "empty_preview_html"
        : !integrity.sourceIntegrityOk
          ? mapLegacyPreviewErrorCode("source_integrity_incomplete")
          : classified.code;
    errorMessage = classified.userMessage;
  }

  const previewRenderable =
    (integrity.previewRenderable && !errorCode) ||
    (staticSnapshotHealthy && !errorCode);

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
