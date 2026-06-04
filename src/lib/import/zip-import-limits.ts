/** Shared ZIP import / preview upload limits (must match storage bucket + worker config). */
export const ZIP_IMPORT_MAX_MB = 250;

export const ZIP_IMPORT_MAX_BYTES = ZIP_IMPORT_MAX_MB * 1024 * 1024;

/** Include in API responses wherever upload limits are surfaced. */
export const ZIP_IMPORT_UPLOAD_LIMITS = {
  maxUploadSizeMb: ZIP_IMPORT_MAX_MB,
  maxUploadBytes: ZIP_IMPORT_MAX_BYTES,
} as const;

export function zipTooLargeErrorPayload(): {
  error: string;
  code: "ZIP_TOO_LARGE";
  maxUploadSizeMb: number;
} {
  return {
    error: `ZIP too large (maximum size: ${ZIP_IMPORT_MAX_MB} MB)`,
    code: "ZIP_TOO_LARGE",
    maxUploadSizeMb: ZIP_IMPORT_MAX_MB,
  };
}
