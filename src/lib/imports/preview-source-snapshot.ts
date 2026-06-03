import "server-only";

import JSZip from "jszip";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensurePrivateBucket } from "@/lib/supabase/ensure-storage-bucket";
import type { ZipImportFile } from "@/lib/import/zip-file-validator";

export const PREVIEW_SOURCES_BUCKET = "preview-sources";

const MAX_SNAPSHOT_BYTES = 200 * 1024 * 1024;

export async function createSourceSnapshotZip(files: ZipImportFile[]): Promise<Buffer> {
  const zip = new JSZip();
  let total = 0;
  for (const file of files) {
    const buf = Buffer.from(file.content, "utf8");
    total += buf.length;
    if (total > MAX_SNAPSHOT_BYTES) {
      throw new Error("Source snapshot exceeds 200MB limit");
    }
    zip.file(file.path.replace(/\\/g, "/"), buf);
  }
  return Buffer.from(await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

export async function uploadSourceSnapshot(input: {
  admin: SupabaseClient;
  projectId: string;
  jobId: string;
  files: ZipImportFile[];
}): Promise<{ ok: true; sourceSnapshotPath: string } | { ok: false; error: string }> {
  const bucket = await ensurePrivateBucket(input.admin, PREVIEW_SOURCES_BUCKET, {
    fileSizeLimit: 50 * 1024 * 1024,
  });
  if (!bucket.ok) return { ok: false, error: bucket.error };

  try {
    const zipBuf = await createSourceSnapshotZip(input.files);
    const storagePath = `${input.projectId}/${input.jobId}/source.zip`;
    const { error } = await input.admin.storage
      .from(PREVIEW_SOURCES_BUCKET)
      .upload(storagePath, zipBuf, {
        contentType: "application/zip",
        upsert: true,
      });
    if (error) return { ok: false, error: error.message };
    return { ok: true, sourceSnapshotPath: storagePath };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Source snapshot failed" };
  }
}
