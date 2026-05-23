/** Private Supabase Storage bucket for ZIP import archives (not public). */
export const ZIP_IMPORT_BUCKET = "zip-imports";

export const ZIP_IMPORT_MAX_BYTES = 25 * 1024 * 1024;

export const ZIP_IMPORT_ALLOWED_MIMES = [
  "application/zip",
  "application/x-zip-compressed",
] as const;

export const ZIP_IMPORT_STORAGE_MIGRATION =
  "supabase/migrations/20260623120000_zip_imports_storage.sql";

export function sanitizeZipArchiveFilename(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() ?? "source.zip";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  if (!cleaned.toLowerCase().endsWith(".zip")) return `${cleaned || "source"}.zip`;
  return cleaned || "source.zip";
}

/** Owner-scoped path inside the zip-imports bucket. */
export function buildZipImportStoragePath(
  userId: string,
  importId: string,
  originalFilename?: string,
): string {
  const fileName = sanitizeZipArchiveFilename(originalFilename ?? "source.zip");
  return `${userId}/${importId}/${fileName}`;
}

export function supabaseProjectRefFromUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const m = url.match(/https:\/\/([^.]+)\.supabase\.co/i);
  return m?.[1];
}

export type ImportStorageSetupDetail = {
  bucket: string;
  migration: string;
  setupCommand: string;
  supabaseProjectRef?: string;
};

export function importStorageNotConfiguredUserMessage(): string {
  return "Import storage is not configured yet. Please contact the workspace owner or try again after setup.";
}

export function importStorageSetupDetail(): ImportStorageSetupDetail {
  return {
    bucket: ZIP_IMPORT_BUCKET,
    migration: ZIP_IMPORT_STORAGE_MIGRATION,
    setupCommand: "npm run setup:zip-import-storage",
    supabaseProjectRef: supabaseProjectRefFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
  };
}

export function isStorageBucketMissingError(message: string): boolean {
  return /bucket not found|Bucket not found|404/i.test(message);
}

export function formatImportStorageError(rawMessage: string): {
  error: string;
  code: "IMPORT_STORAGE_NOT_CONFIGURED";
  adminDetail: ImportStorageSetupDetail;
  rawMessage: string;
} {
  return {
    error: importStorageNotConfiguredUserMessage(),
    code: "IMPORT_STORAGE_NOT_CONFIGURED",
    adminDetail: importStorageSetupDetail(),
    rawMessage,
  };
}
