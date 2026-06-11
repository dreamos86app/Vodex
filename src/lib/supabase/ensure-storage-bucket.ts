import type { SupabaseAdminClient } from "@/lib/supabase/admin";
import { ZIP_IMPORT_MAX_BYTES } from "@/lib/import/zip-import-limits";

export type EnsureBucketResult =
  | { ok: true }
  | {
      ok: false;
      error: string;
      hint?: string;
      code?: "BUCKET_LIST_FAILED" | "BUCKET_CREATE_FAILED" | "BUCKET_NOT_PRIVATE";
    };

/**
 * Ensure a public storage bucket exists (service role). Idempotent.
 */
export async function ensurePublicBucket(
  admin: SupabaseAdminClient,
  bucketId: string,
  options?: { fileSizeLimit?: number },
): Promise<EnsureBucketResult> {
  const fileSizeLimit = options?.fileSizeLimit ?? 5 * 1024 * 1024;
  const { data: buckets, error: listErr } = await admin.storage.listBuckets();
  if (listErr) {
    return {
      ok: false,
      error: listErr.message,
      hint: "Check SUPABASE_SECRET_KEY and Storage permissions for the service role.",
    };
  }
  if (buckets?.some((b: { id: string }) => b.id === bucketId)) {
    return { ok: true };
  }

  const { error: createErr } = await admin.storage.createBucket(bucketId, {
    public: true,
    fileSizeLimit,
  });

  if (createErr) {
    return {
      ok: false,
      error: createErr.message,
      hint: `Create a public Storage bucket named "${bucketId}" in the Supabase dashboard (Storage → New bucket → public).`,
    };
  }

  return { ok: true };
}

/**
 * Ensure a private storage bucket exists (service role). Idempotent.
 */
export async function ensurePrivateBucket(
  admin: SupabaseAdminClient,
  bucketId: string,
  options?: {
    fileSizeLimit?: number;
    allowedMimeTypes?: string[];
  },
): Promise<EnsureBucketResult> {
  const fileSizeLimit = options?.fileSizeLimit ?? ZIP_IMPORT_MAX_BYTES;
  const allowedMimeTypes = options?.allowedMimeTypes ?? [
    "application/zip",
    "application/x-zip-compressed",
  ];

  const { data: buckets, error: listErr } = await admin.storage.listBuckets();
  if (listErr) {
    return {
      ok: false,
      code: "BUCKET_LIST_FAILED",
      error: listErr.message,
      hint: "Check SUPABASE_SERVICE_ROLE_KEY and Storage permissions for the service role.",
    };
  }

  const existing = buckets?.find((b: { id: string; public?: boolean }) => b.id === bucketId);
  if (existing) {
    if (existing.public) {
      return {
        ok: false,
        code: "BUCKET_NOT_PRIVATE",
        error: `Storage bucket "${bucketId}" must be private for ZIP imports.`,
        hint: `Set bucket "${bucketId}" to private in Supabase Storage settings.`,
      };
    }
    return { ok: true };
  }

  const { error: createErr } = await admin.storage.createBucket(bucketId, {
    public: false,
    fileSizeLimit,
    allowedMimeTypes,
  });

  if (createErr) {
    return {
      ok: false,
      code: "BUCKET_CREATE_FAILED",
      error: createErr.message,
      hint: `Create a private Storage bucket named "${bucketId}" (Storage → New bucket → private). Or run: npm run setup:zip-import-storage`,
    };
  }

  return { ok: true };
}
