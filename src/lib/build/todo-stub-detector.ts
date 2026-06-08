/**
 * Precise TODO/stub detection — avoids false positives on substantial multi-route apps.
 */
import type { BuildFile } from "@/lib/build/generated-file-utils";
import { normalizeBuildFilePath } from "@/lib/build/generated-file-utils";
import {
  fileMeetsMeaningfulThreshold,
  findPrimaryAppPage,
} from "@/lib/build/source-integrity-validator";

export type TodoStubMatch = {
  file_path: string;
  detector: string;
  snippet: string;
  severity: "blocking" | "warning";
  blocking: boolean;
};

export type TodoStubScanResult = {
  matches: TodoStubMatch[];
  blockingMatches: TodoStubMatch[];
  warningMatches: TodoStubMatch[];
  shouldBlockPreview: boolean;
  primaryRouteStubbed: boolean;
};

export const SUBSTANTIAL_PREVIEW_FILE_THRESHOLD = 25;
export const SUBSTANTIAL_PREVIEW_ROUTE_THRESHOLD = 5;

const ROOT_STUB_PHRASES = [
  /coming\s+soon/i,
  /placeholder\s+only/i,
  /your app will appear here/i,
  /under construction/i,
  /not implemented yet/i,
  /page under development/i,
  /main content goes here/i,
  /lorem ipsum/i,
] as const;

const TODO_ONLY_FILE_RE = /^\s*(\/\/\s*)?(todo|fixme)\b/i;

function snippet(content: string, max = 120): string {
  const one = content.replace(/\s+/g, " ").trim();
  return one.length <= max ? one : `${one.slice(0, max)}…`;
}

function isPageFile(path: string): boolean {
  return /(^|\/)page\.(tsx|jsx)$/i.test(normalizeBuildFilePath(path));
}

function primaryPagePath(files: BuildFile[]): string | null {
  const primary = findPrimaryAppPage(files);
  return primary ? normalizeBuildFilePath(primary.path) : null;
}

function isPrimaryPage(path: string, primaryPath: string | null): boolean {
  const norm = normalizeBuildFilePath(path);
  if (primaryPath) return norm === primaryPath;
  return /^app\/page\.(tsx|jsx)$/i.test(norm);
}

function jsxBodyLooksStub(content: string): boolean {
  const t = content.trim();
  if (!t) return true;
  if (t.length < 120 && !fileMeetsMeaningfulThreshold({ path: "app/page.tsx", content: t })) {
    return true;
  }
  if (TODO_ONLY_FILE_RE.test(t)) return true;
  for (const re of ROOT_STUB_PHRASES) {
    if (re.test(t)) return true;
  }
  return false;
}

function todoInCommentOnly(content: string): boolean {
  const lines = content.split("\n");
  const todoLines = lines.filter((l) => /\b(TODO|FIXME)\b/i.test(l));
  if (todoLines.length === 0) return false;
  return todoLines.every((l) => /^\s*(\/\/|\/\*|\*)/.test(l.trim()) || l.trim().startsWith("*"));
}

export function detectTodoStubMatches(files: BuildFile[]): TodoStubScanResult {
  const matches: TodoStubMatch[] = [];
  const primaryPath = primaryPagePath(files);
  const uiFiles = files.filter((f) => /\.(tsx|jsx|html)$/i.test(f.path));

  for (const file of uiFiles) {
    const path = normalizeBuildFilePath(file.path);
    const content = file.content ?? "";
    const primary = isPrimaryPage(path, primaryPath);

    if (primary && jsxBodyLooksStub(content)) {
      let detector = "primary_page_stub";
      if (content.trim().length < 120) detector = "primary_page_too_short";
      else if (TODO_ONLY_FILE_RE.test(content.trim())) detector = "primary_page_todo_only";
      else if (ROOT_STUB_PHRASES.some((re) => re.test(content))) detector = "primary_page_placeholder_phrase";

      matches.push({
        file_path: path,
        detector,
        snippet: snippet(content),
        severity: "blocking",
        blocking: true,
      });
      continue;
    }

    if (!primary && isPageFile(path) && jsxBodyLooksStub(content)) {
      matches.push({
        file_path: path,
        detector: "secondary_route_stub",
        snippet: snippet(content),
        severity: "warning",
        blocking: false,
      });
      continue;
    }

    if (!primary && /\b(TODO|FIXME)\b/i.test(content) && !todoInCommentOnly(content)) {
      matches.push({
        file_path: path,
        detector: "inline_todo_in_source",
        snippet: snippet(content),
        severity: "warning",
        blocking: false,
      });
    }
  }

  const blockingMatches = matches.filter((m) => m.blocking);
  const warningMatches = matches.filter((m) => !m.blocking);
  const primaryRouteStubbed = blockingMatches.some((m) =>
    isPrimaryPage(m.file_path, primaryPath),
  );

  return {
    matches,
    blockingMatches,
    warningMatches,
    shouldBlockPreview: primaryRouteStubbed,
    primaryRouteStubbed,
  };
}

export function isSubstantialPreviewApp(input: {
  fileCount: number;
  packageJsonExists: boolean;
  entrypointExists: boolean;
  routeCount: number;
}): boolean {
  return (
    input.fileCount >= SUBSTANTIAL_PREVIEW_FILE_THRESHOLD &&
    input.packageJsonExists &&
    input.entrypointExists &&
    input.routeCount >= SUBSTANTIAL_PREVIEW_ROUTE_THRESHOLD
  );
}

/** Split validation: blocking reasons fail preview; warnings are stored only. */
export function applyTodoStubGate(input: {
  files: BuildFile[];
  fileCount?: number;
  routeCount?: number;
}): {
  blockingReasons: string[];
  warnings: string[];
  scan: TodoStubScanResult;
  todoStubMatches: TodoStubMatch[];
} {
  const files = input.files;
  const scan = detectTodoStubMatches(files);
  const packageJsonExists = files.some((f) => normalizeBuildFilePath(f.path) === "package.json");
  const entrypointExists = files.some(
    (f) =>
      /^app\/(page|layout)\.(tsx|jsx)$/i.test(normalizeBuildFilePath(f.path)) ||
      f.path === "index.html",
  );
  const routeCount =
    input.routeCount ??
    files.filter((f) => /(^|\/)page\.(tsx|jsx)$/i.test(normalizeBuildFilePath(f.path))).length;

  const substantial = isSubstantialPreviewApp({
    fileCount: input.fileCount ?? files.length,
    packageJsonExists,
    entrypointExists,
    routeCount: Math.max(routeCount, 1),
  });

  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  if (scan.shouldBlockPreview) {
    const primary = scan.blockingMatches[0];
    blockingReasons.push(
      primary
        ? `todo_or_stub_page:${primary.file_path}`
        : "todo_or_stub_page",
    );
  } else if (!substantial && scan.warningMatches.length > 0) {
    const worst = scan.warningMatches[0]!;
    blockingReasons.push(`todo_or_stub_page:${worst.file_path}`);
  }

  for (const m of scan.warningMatches) {
    warnings.push(`todo_stub_warning:${m.detector}:${m.file_path}`);
  }

  return {
    blockingReasons,
    warnings,
    scan,
    todoStubMatches: scan.matches,
  };
}

export function parseTodoStubFilePath(reason: string): string | null {
  const m = reason.match(/^todo_or_stub_page:(.+)$/);
  return m?.[1] ?? null;
}

export function buildTodoStubRepairPrompt(match: TodoStubMatch, appName?: string): string {
  return [
    "TODO/STUB PAGE REPAIR — replace stub content with real UI for this route only.",
    `File: ${match.file_path}`,
    `Detector: ${match.detector}`,
    `Snippet: ${match.snippet}`,
    "",
    "RULES:",
    "- Do NOT reduce app scope, routes, or file count.",
    "- Do NOT replace the full app with a generic scaffold.",
    `- Replace stub/TODO content in ${match.file_path} with production-ready UI.`,
    "- Keep imports and sibling routes intact.",
    appName ? `App name: ${appName}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
