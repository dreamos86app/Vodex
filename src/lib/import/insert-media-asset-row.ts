import type { SupabaseClient } from "@supabase/supabase-js";

function isSchemaColumnError(message: string): boolean {
  return (
    /could not find/i.test(message) ||
    /column.*does not exist/i.test(message) ||
    /schema cache/i.test(message)
  );
}

export type MediaAssetInsertInput = {
  userId: string;
  projectId: string;
  filename: string;
  storagePath: string;
  publicUrl: string;
  mimeType: string;
  sizeBytes: number;
  zipImportPath: string;
  assetType: "image" | "video" | "document";
};

/** Insert into media_assets — works with both extended and foundational schemas. */
export async function insertMediaAssetRow(
  admin: SupabaseClient,
  input: MediaAssetInsertInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const tags = ["zip_import", input.zipImportPath];
  const metadata = {
    asset_type: input.assetType,
    generated: false,
    tags,
    zip_import_path: input.zipImportPath,
  };

  const extended = {
    user_id: input.userId,
    project_id: input.projectId,
    filename: input.filename,
    storage_path: input.storagePath,
    public_url: input.publicUrl,
    mime_type: input.mimeType,
    size_bytes: input.sizeBytes,
    asset_type: input.assetType,
    generated: false,
    tags,
    metadata,
  };

  let { error } = await admin.from("media_assets").insert(extended as never);
  if (error && isSchemaColumnError(error.message)) {
    ({ error } = await admin.from("media_assets").insert({
      user_id: input.userId,
      project_id: input.projectId,
      filename: input.filename,
      storage_path: input.storagePath,
      public_url: input.publicUrl,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      metadata,
    } as never));
  }

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
