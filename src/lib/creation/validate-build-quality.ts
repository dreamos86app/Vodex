const REJECT_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bSample Item\b/i, reason: "contains placeholder Sample Item" },
  { pattern: /\bLorem ipsum\b/i, reason: "contains lorem ipsum" },
  { pattern: /\bTODO:\s*implement\b/i, reason: "contains TODO placeholders" },
];

function normalizeFilePath(path: string): string {
  return path.replace(/^\.?\//, "").replace(/\\/g, "/");
}

function isPageFile(path: string): boolean {
  const p = normalizeFilePath(path);
  return (
    /(^|\/)page\.(tsx|jsx|js)$/i.test(p) ||
    /(^|\/)pages?\//i.test(p) ||
    /index\.html$/i.test(p)
  );
}

export type BuildQualityResult = {
  ok: boolean;
  reasons: string[];
  pageCount: number;
  fileCount: number;
};

export function validateGeneratedBuild(files: Array<{ path: string; content: string }>): BuildQualityResult {
  const reasons: string[] = [];
  const combined = files.map((f) => f.content).join("\n");

  for (const { pattern, reason } of REJECT_PATTERNS) {
    if (pattern.test(combined)) reasons.push(reason);
  }

  const pagePaths = files.filter((f) => isPageFile(f.path));
  const substantialHtml = files.some(
    (f) => /index\.html$/i.test(f.path) && (f.content?.trim().length ?? 0) >= 400,
  );
  const previewOnly =
    files.length <= 2 &&
    files.every((f) => f.path.includes("preview")) &&
    !substantialHtml;
  if (previewOnly) reasons.push("only preview file generated");
  if (pagePaths.length < 1 && !substantialHtml) {
    reasons.push("no pages or screens detected");
  }

  const genericDashboardOnly =
    files.length <= 3 &&
    /dashboard/i.test(combined) &&
    !/inventory|supplier|order|alert|analytics/i.test(combined);
  if (genericDashboardOnly) reasons.push("generic single-dashboard output");

  return {
    ok: reasons.length === 0,
    reasons,
    pageCount: pagePaths.length,
    fileCount: files.length,
  };
}
