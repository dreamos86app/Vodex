/** Backward-compatible re-exports — prefer @/lib/import/* for new code. */
export {
  type ZipImportFile,
  shouldSkipZipPath,
  normalizeZipEntryPath,
  accumulateIfOk,
  isSecretZipPath,
  ZIP_IMPORT_LIMITS,
} from "@/lib/import/zip-file-validator";

import type { ZipImportFile } from "@/lib/import/zip-file-validator";
import { detectFramework } from "@/lib/import/framework-detector";

export function detectFrameworkHint(files: ZipImportFile[]): string {
  return detectFramework(files).id;
}
