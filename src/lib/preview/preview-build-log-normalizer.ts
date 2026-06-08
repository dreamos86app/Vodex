/**
 * Normalize preview worker / npm / vite build logs into structured errors.
 */

export type NormalizedPreviewBuildLog = {
  build_logs_tail: string[];
  npm_error: string | null;
  vite_error: string | null;
  typescript_error: string | null;
  missing_imports: string[];
  missing_files: string[];
  invalid_exports: string[];
  unsupported_packages: string[];
  failing_file: string | null;
  failing_line: number | null;
  suggested_repair_action: string | null;
};

const TAIL_LINES = 200;

function tailLines(logs: string, max = TAIL_LINES): string[] {
  return logs
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter(Boolean)
    .slice(-max);
}

export function normalizePreviewBuildLogs(
  logs: string | null | undefined,
): NormalizedPreviewBuildLog {
  const empty: NormalizedPreviewBuildLog = {
    build_logs_tail: [],
    npm_error: null,
    vite_error: null,
    typescript_error: null,
    missing_imports: [],
    missing_files: [],
    invalid_exports: [],
    unsupported_packages: [],
    failing_file: null,
    failing_line: null,
    suggested_repair_action: null,
  };
  if (!logs?.trim()) return empty;

  const lines = tailLines(logs);
  const joined = lines.join("\n");

  let npm_error: string | null = null;
  if (/npm ERR!|ERESOLVE|peer dep|dependency install failed/i.test(joined)) {
    npm_error = lines.find((l) => /npm ERR!|ERESOLVE|install failed/i.test(l)) ?? lines.slice(-3).join(" ");
  }

  let vite_error: string | null = null;
  const viteLine = lines.find((l) => /\[vite\]|vite build failed|Rollup failed/i.test(l));
  if (viteLine) vite_error = viteLine;

  let typescript_error: string | null = null;
  const tsLine = lines.find((l) => /TS\d{4}:|Type error:|typescript error/i.test(l));
  if (tsLine) typescript_error = tsLine;

  const missing_imports = [
    ...joined.matchAll(/Cannot find module ['"]([^'"]+)['"]/gi),
    ...joined.matchAll(/Failed to resolve import ["']([^"']+)["']/gi),
  ]
    .map((m) => m[1]!)
    .filter(Boolean);

  const missing_files = [
    ...joined.matchAll(/ENOENT.*['"]([^'"]+\.(?:tsx?|jsx?|css))['"]/gi),
  ].map((m) => m[1]!);

  const invalid_exports = [
    ...joined.matchAll(/export .* was not found in ['"]([^'"]+)['"]/gi),
    ...joined.matchAll(/does not provide an export named ['"]([^'"]+)['"]/gi),
  ].map((m) => m[1]!);

  const unsupported_packages = [
    ...joined.matchAll(/Module not found: Can't resolve ['"]([^'"]+)['"]/gi),
  ]
    .map((m) => m[1]!)
    .filter((p) => !p.startsWith(".") && !p.startsWith("@/"));

  let failing_file: string | null = null;
  let failing_line: number | null = null;
  const fileLine =
    joined.match(/([^\s:]+\.(?:tsx|ts|jsx|js)):(\d+):(\d+)/) ??
    joined.match(/at\s+([^\s:]+\.(?:tsx|ts|jsx|js)):(\d+)/);
  if (fileLine) {
    failing_file = fileLine[1] ?? null;
    failing_line = fileLine[2] ? Number(fileLine[2]) : null;
  }

  let suggested_repair_action: string | null = null;
  if (missing_imports.length) {
    suggested_repair_action = `Fix missing imports: ${[...new Set(missing_imports)].slice(0, 4).join(", ")}`;
  } else if (typescript_error) {
    suggested_repair_action = "Fix TypeScript compile errors in the reported file without reducing app scope.";
  } else if (npm_error) {
    suggested_repair_action = "Repair package.json dependencies and retry preview build.";
  } else if (vite_error) {
    suggested_repair_action = "Fix Vite build configuration or the failing module.";
  }

  return {
    build_logs_tail: lines,
    npm_error,
    vite_error,
    typescript_error,
    missing_imports: [...new Set(missing_imports)],
    missing_files: [...new Set(missing_files)],
    invalid_exports: [...new Set(invalid_exports)],
    unsupported_packages: [...new Set(unsupported_packages)],
    failing_file,
    failing_line,
    suggested_repair_action,
  };
}
