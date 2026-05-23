import JSZip from "jszip";
import {
  normalizeZipEntryPath,
  shouldSkipZipPath,
  isSecretZipPath,
  accumulateIfOk,
  ZIP_IMPORT_LIMITS,
  type ZipImportFile,
} from "@/lib/import/zip-file-validator";
import { validateImportedApp, type ImportedAppValidation } from "@/lib/import/imported-app-validator";

const TEXT_EXT = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "json",
  "md",
  "mdx",
  "css",
  "scss",
  "html",
  "htm",
  "svg",
  "txt",
  "yml",
  "yaml",
]);

export type ZipScanStats = {
  rawEntries: number;
  skippedIgnoredPaths: number;
  skippedBinary: number;
  rejectedSecrets: number;
  rejectedPaths: number;
  acceptedFiles: number;
  /** Deterministic scan — no LLM; always zero provider spend. */
  scanProviderCostUsd: 0;
};

export type ZipExtractResult =
  | {
      ok: true;
      files: ZipImportFile[];
      validation: ImportedAppValidation;
      rejectedSecrets: string[];
      rejectedPaths: string[];
      stats: ZipScanStats;
    }
  | { ok: false; error: string };

function extOf(path: string): string {
  const i = path.lastIndexOf(".");
  return i >= 0 ? path.slice(i + 1).toLowerCase() : "";
}

/** Deterministic ZIP extract + framework analysis — no LLM calls. */
export async function extractAndAnalyzeZip(buffer: Buffer): Promise<ZipExtractResult> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    return { ok: false, error: "Invalid or corrupted ZIP file" };
  }

  const acc: {
    files: ZipImportFile[];
    total: number;
    rejectedSecrets: string[];
    rejectedPaths: string[];
  } = { files: [], total: 0, rejectedSecrets: [], rejectedPaths: [] };

  const stats: ZipScanStats = {
    rawEntries: 0,
    skippedIgnoredPaths: 0,
    skippedBinary: 0,
    rejectedSecrets: 0,
    rejectedPaths: 0,
    acceptedFiles: 0,
    scanProviderCostUsd: 0,
  };

  for (const [rawPath, entry] of Object.entries(zip.files)) {
    if (!entry || entry.dir) continue;
    stats.rawEntries += 1;

    const normalized = normalizeZipEntryPath(rawPath);
    if (!normalized) {
      acc.rejectedPaths.push(rawPath);
      stats.rejectedPaths += 1;
      continue;
    }
    if (shouldSkipZipPath(normalized)) {
      if (isSecretZipPath(normalized)) {
        acc.rejectedSecrets.push(normalized);
        stats.rejectedSecrets += 1;
      } else {
        stats.skippedIgnoredPaths += 1;
      }
      continue;
    }
    const ext = extOf(normalized);
    if (!TEXT_EXT.has(ext)) {
      stats.skippedBinary += 1;
      continue;
    }

    let content: string;
    try {
      content = await entry.async("string");
    } catch {
      stats.skippedBinary += 1;
      continue;
    }
    const ok = accumulateIfOk(acc, normalized, content);
    if (!ok.ok) return { ok: false, error: ok.error };
  }

  stats.acceptedFiles = acc.files.length;

  if (acc.files.length === 0) {
    return {
      ok: false,
      error: "No importable text files found (secrets, node_modules, and build artifacts are excluded)",
    };
  }

  const validation = validateImportedApp(acc.files, { rejectedSecrets: acc.rejectedSecrets });

  const skippedTotal = stats.skippedIgnoredPaths + stats.skippedBinary;
  if (skippedTotal > 0 && !validation.warnings.some((w) => w.includes("Skipped"))) {
    validation.warnings.unshift(
      `Imported safely. Skipped ${skippedTotal} dependency, build, cache, or non-text files.`,
    );
  }

  return {
    ok: true,
    files: acc.files,
    validation,
    rejectedSecrets: acc.rejectedSecrets,
    rejectedPaths: acc.rejectedPaths,
    stats,
  };
}

export { ZIP_IMPORT_LIMITS };
