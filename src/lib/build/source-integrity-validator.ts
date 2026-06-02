/**
 * Post-persist source integrity — paths alone must not count as a successful build.
 */
import type { BuildFile } from "@/lib/build/generated-file-utils";
import {
  filterRenderableBuildFiles,
  normalizeBuildFilePath,
} from "@/lib/build/generated-file-utils";
import { isThinGeneratedFile } from "@/lib/build/meaningful-file-guard";

function isRedirectOnlyRoot(content: string): boolean {
  const t = content.trim();
  if (!t) return true;
  if (!/redirect\s*\(/i.test(t)) return false;
  return t.split("\n").filter((l) => l.trim().length > 0).length <= 12;
}

/** Pick the page used for static preview + root integrity (dashboard apps redirect from `/`). */
export function findPrimaryAppPage(files: BuildFile[]): BuildFile | undefined {
  const renderable = filterRenderableBuildFiles(files);
  const root = renderable.find((f) =>
    /^app\/page\.(tsx|jsx)$/i.test(normalizeBuildFilePath(f.path)),
  );
  const dashboard = renderable.find((f) =>
    /^app\/dashboard\/page\.(tsx|jsx)$/i.test(normalizeBuildFilePath(f.path)),
  );

  if (root?.content && !isRedirectOnlyRoot(root.content) && fileMeetsMeaningfulThreshold(root)) {
    return root;
  }
  if (dashboard?.content && fileMeetsMeaningfulThreshold(dashboard)) {
    return dashboard;
  }
  if (root?.content?.trim()) return root;
  if (dashboard?.content?.trim()) return dashboard;

  return (
    renderable.find((f) => /^app\/[^/]+\/page\.(tsx|jsx)$/i.test(normalizeBuildFilePath(f.path))) ||
    renderable.find((f) => /\/page\.(tsx|jsx)$/i.test(normalizeBuildFilePath(f.path)))
  );
}

export function primaryAppPageHasRealContent(files: BuildFile[]): boolean {
  const page = findPrimaryAppPage(files);
  return page ? fileMeetsMeaningfulThreshold(page) : false;
}

const PLACEHOLDER_CONTENT_RE =
  /select a file from the tree|no generated files|lorem ipsum only|coming soon\.\.\.|your app routes stay connected|this screen was added automatically|upgrade to a paid plan|upgrade to .* plan to edit/i;

const TODO_ONLY_RE = /^\s*(\/\/\s*)?todo\b/i;

export type SourceIntegrityReport = {
  totalFileRows: number;
  readableFileCount: number;
  nonEmptyFileCount: number;
  meaningfulSourceFileCount: number;
  emptyFileCount: number;
  placeholderFileCount: number;
  oneLineFileCount: number;
  codeTabReadableCount: number;
  rootPageHasRealContent: boolean;
  packageJsonHasRealContent: boolean;
  layoutHasRealContent: boolean;
  globalsHasRealContent: boolean;
  sourceIntegrityOk: boolean;
  previewRenderable: boolean;
  blockedReason: string | null;
  readyReason: string | null;
};

function meaningfulLineCount(content: string): number {
  return content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("//") && !l.startsWith("/*")).length;
}

function isPlaceholderContent(content: string): boolean {
  const t = content.trim();
  if (!t) return true;
  if (PLACEHOLDER_CONTENT_RE.test(t)) return true;
  if (TODO_ONLY_RE.test(t)) return true;
  if (/^export\s+default\s+function\s+\w*\s*\(\s*\)\s*\{\s*return\s+null\s*;?\s*\}\s*$/i.test(t)) {
    return true;
  }
  return false;
}

type FileRule = {
  test: (path: string) => boolean;
  minLines: number;
  minChars: number;
};

const FILE_RULES: FileRule[] = [
  {
    test: (p) => /(^|\/)app\/page\.(tsx|jsx)$/i.test(p),
    minLines: 40,
    minChars: 1500,
  },
  {
    test: (p) => /(^|\/)app\/[^/]+\/page\.(tsx|jsx)$/i.test(p) && !/(^|\/)app\/page\./i.test(p),
    minLines: 25,
    minChars: 900,
  },
  {
    test: (p) => /^components\/.+\.(tsx|jsx)$/i.test(p),
    minLines: 25,
    minChars: 900,
  },
  {
    test: (p) => /^lib\/mock-data\.(ts|js)$/i.test(p),
    minLines: 20,
    minChars: 800,
  },
  {
    test: (p) => p === "app/layout.tsx" || /(^|\/)app\/layout\.(tsx|jsx)$/i.test(p),
    minLines: 15,
    minChars: 400,
  },
  {
    test: (p) => p === "app/globals.css" || /(^|\/)app\/globals\.css$/i.test(p),
    minLines: 8,
    minChars: 120,
  },
];

export function fileMeetsMeaningfulThreshold(file: BuildFile): boolean {
  const path = normalizeBuildFilePath(file.path);
  const content = file.content ?? "";
  if (isPlaceholderContent(content)) return false;
  if (isThinGeneratedFile(file)) return false;

  if (path === "package.json") {
    try {
      const parsed = JSON.parse(content) as { dependencies?: unknown; scripts?: unknown };
      return Boolean(parsed.dependencies && Object.keys(parsed.dependencies).length > 0);
    } catch {
      return false;
    }
  }

  const lines = meaningfulLineCount(content);
  const chars = content.trim().length;
  const rule = FILE_RULES.find((r) => r.test(path));
  if (rule) return lines >= rule.minLines || chars >= rule.minChars;
  if (/\.(tsx|jsx|ts|js)$/i.test(path)) return lines >= 12 || chars >= 350;
  return lines >= 3 || chars >= 80;
}

export function evaluateSourceIntegrity(
  rawFiles: BuildFile[],
  options?: {
    previewHtmlLength?: number;
    previewSessionOk?: boolean;
    previewHtmlSnippet?: string;
  },
): SourceIntegrityReport {
  const files = filterRenderableBuildFiles(rawFiles);
  const totalFileRows = rawFiles.length;

  let readableFileCount = 0;
  let nonEmptyFileCount = 0;
  let meaningfulSourceFileCount = 0;
  let emptyFileCount = 0;
  let placeholderFileCount = 0;
  let oneLineFileCount = 0;
  let codeTabReadableCount = 0;

  for (const f of files) {
    const content = f.content ?? "";
    const lines = meaningfulLineCount(content);
    if (content.trim().length > 0) nonEmptyFileCount += 1;
    else emptyFileCount += 1;
    if (lines <= 1 && content.trim().length > 0) oneLineFileCount += 1;
    if (isPlaceholderContent(content)) {
      placeholderFileCount += 1;
      continue;
    }
    if (content.trim().length >= 40) readableFileCount += 1;
    if (fileMeetsMeaningfulThreshold(f)) {
      meaningfulSourceFileCount += 1;
      codeTabReadableCount += 1;
    }
  }

  const pkg = files.find((f) => normalizeBuildFilePath(f.path) === "package.json");
  const layout = files.find((f) => /(^|\/)app\/layout\.(tsx|jsx)$/i.test(normalizeBuildFilePath(f.path)));
  const globals = files.find((f) => /(^|\/)app\/globals\.css$/i.test(normalizeBuildFilePath(f.path)));

  const rootPageHasRealContent = primaryAppPageHasRealContent(files);
  const packageJsonHasRealContent = pkg ? fileMeetsMeaningfulThreshold(pkg) : false;
  const layoutHasRealContent = layout ? fileMeetsMeaningfulThreshold(layout) : false;
  const globalsHasRealContent = globals ? fileMeetsMeaningfulThreshold(globals) : false;

  const minMeaningful = meaningfulSourceFileCount >= 8 ? 6 : 4;
  const portfolioBuild = files.some((f) =>
    /(^|\/)lib\/portfolio-data\.(ts|js)$/i.test(normalizeBuildFilePath(f.path)),
  );
  const totalSourceBytes = files.reduce((n, f) => n + (f.content?.length ?? 0), 0);
  /** Premium portfolio scaffold is ~26KB; merged model output must meet this floor. */
  const PORTFOLIO_MIN_BYTES = 26_000;

  const coreOk =
    rootPageHasRealContent &&
    packageJsonHasRealContent &&
    layoutHasRealContent &&
    meaningfulSourceFileCount >= minMeaningful &&
    (!portfolioBuild || totalSourceBytes >= PORTFOLIO_MIN_BYTES);

  const previewHtmlLength = options?.previewHtmlLength ?? 0;
  const previewSessionOk = options?.previewSessionOk === true;
  const previewHtmlSnippet = options?.previewHtmlSnippet ?? "";
  const htmlLooksEmpty =
    previewHtmlLength > 0 &&
    (previewHtmlLength < 400 || /no renderable content/i.test(previewHtmlSnippet));
  const sourceIntegrityOk = coreOk;
  const previewRenderable =
    coreOk && !htmlLooksEmpty && (previewSessionOk === true || previewHtmlLength >= 800);

  let blockedReason: string | null = null;
  if (totalFileRows > 0 && meaningfulSourceFileCount === 0) {
    blockedReason = "technical_generation_incomplete:no_meaningful_source";
  } else if (!rootPageHasRealContent) {
    blockedReason = "technical_generation_incomplete:missing_root_page_content";
  } else if (!packageJsonHasRealContent) {
    blockedReason = "technical_generation_incomplete:invalid_package_json";
  } else if (meaningfulSourceFileCount < minMeaningful) {
    blockedReason = "technical_generation_incomplete:insufficient_meaningful_files";
  } else if (portfolioBuild && totalSourceBytes < PORTFOLIO_MIN_BYTES) {
    blockedReason = "technical_generation_incomplete:portfolio_thin_output";
  }

  const readyReason =
    sourceIntegrityOk && previewRenderable
      ? "source_integrity_ok_preview_live"
      : sourceIntegrityOk
        ? "source_integrity_ok_preview_pending"
        : null;

  return {
    totalFileRows,
    readableFileCount,
    nonEmptyFileCount,
    meaningfulSourceFileCount,
    emptyFileCount,
    placeholderFileCount,
    oneLineFileCount,
    codeTabReadableCount,
    rootPageHasRealContent,
    packageJsonHasRealContent,
    layoutHasRealContent,
    globalsHasRealContent,
    sourceIntegrityOk,
    previewRenderable,
    blockedReason,
    readyReason,
  };
}

export function isPortfolioBuildPrompt(prompt: string): boolean {
  return /\b(portfolio|developer portfolio|showcase|case stud)/i.test(prompt);
}
