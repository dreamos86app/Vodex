/**
 * Safe ZIP path normalization and accumulation limits.
 */
export type ZipImportFile = { path: string; content: string; sizeBytes: number };

const IGNORE_DIR_PREFIXES = [
  "node_modules/",
  ".next/",
  "dist/",
  "build/",
  ".git/",
  ".turbo/",
  "coverage/",
  ".cache/",
  "out/",
  ".vercel/",
];

const SECRET_PATH_PATTERNS = [
  /^\.env$/i,
  /^\.env\./i,
  /\.env\.local$/i,
  /\.env\.production$/i,
  /secrets?\./i,
  /credentials\.json$/i,
  /\.pem$/i,
  /\.key$/i,
  /id_rsa/i,
  /service.?role/i,
];

export const ZIP_IMPORT_LIMITS = {
  MAX_FILES: 1500,
  MAX_FILE_BYTES: 1_500_000,
  MAX_TOTAL_UNCOMPRESSED: 40 * 1024 * 1024,
};

export function tooManyAcceptedFilesError(acceptedCount: number): string {
  return `This ZIP has ${acceptedCount.toLocaleString()} source files. DreamOS86 currently supports up to ${ZIP_IMPORT_LIMITS.MAX_FILES.toLocaleString()} accepted source files. Remove generated folders like node_modules, .next, dist, build, or cache and try again.`;
}

export function shouldSkipZipPath(normalized: string): boolean {
  if (!normalized || normalized.endsWith("/")) return true;
  const lower = normalized.toLowerCase();
  if (IGNORE_DIR_PREFIXES.some((p) => lower.startsWith(p))) return true;
  if (SECRET_PATH_PATTERNS.some((re) => re.test(lower))) return true;
  return false;
}

export function isSecretZipPath(normalized: string): boolean {
  const lower = normalized.toLowerCase();
  return SECRET_PATH_PATTERNS.some((re) => re.test(lower));
}

/** Normalize entry path; returns null if unsafe (traversal, absolute, Windows roots). */
export function normalizeZipEntryPath(raw: string): string | null {
  let p = raw.replace(/\\/g, "/").trim();
  while (p.startsWith("./")) p = p.slice(2);
  if (p.startsWith("/") || /^[a-z]:/i.test(p)) return null;
  const segments = p.split("/");
  if (segments.some((s) => s === "..")) return null;
  return segments.filter(Boolean).join("/");
}

export function accumulateIfOk(
  acc: { files: ZipImportFile[]; total: number; rejectedSecrets: string[]; rejectedPaths: string[] },
  path: string,
  content: string,
): { ok: true } | { ok: false; error: string } {
  if (isSecretZipPath(path)) {
    acc.rejectedSecrets.push(path);
    return { ok: true };
  }
  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes > ZIP_IMPORT_LIMITS.MAX_FILE_BYTES) {
    return { ok: false, error: `File too large after extract: ${path}` };
  }
  if (acc.total + bytes > ZIP_IMPORT_LIMITS.MAX_TOTAL_UNCOMPRESSED) {
    return { ok: false, error: "ZIP expands to more than the allowed total size" };
  }
  if (acc.files.length >= ZIP_IMPORT_LIMITS.MAX_FILES) {
    return { ok: false, error: tooManyAcceptedFilesError(acc.files.length + 1) };
  }
  acc.files.push({ path, content, sizeBytes: bytes });
  acc.total += bytes;
  return { ok: true };
}

/** @deprecated use framework-detector */
export function detectFrameworkHint(files: ZipImportFile[]): string {
  const { detectFramework } = require("@/lib/import/framework-detector") as typeof import("@/lib/import/framework-detector");
  return detectFramework(files).id;
}
