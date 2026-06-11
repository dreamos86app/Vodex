import JSZip from "jszip";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeZipEntryPath,
  shouldSkipZipPath,
  isSecretZipPath,
} from "@/lib/import/zip-file-validator";
import { ensurePublicBucket } from "@/lib/supabase/ensure-storage-bucket";
import { PREVIEW_ARTIFACTS_BUCKET } from "@/lib/imports/preview-artifact-storage";

const BINARY_EXT = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "ico",
  "avif",
  "woff",
  "woff2",
  "ttf",
  "otf",
  "eot",
  "mp4",
  "webm",
  "mp3",
  "wav",
  "pdf",
  "json",
]);

const LOTTIE_PATH_RE = /lottie|animation|ripo|motion|splash|welcome|loader/i;

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  ico: "image/x-icon",
  avif: "image/avif",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  eot: "application/vnd.ms-fontobject",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  pdf: "application/pdf",
  json: "application/json",
};

const MEDIA_BUCKET = "media";

export type ZipBinaryImportResult = {
  imported: number;
  skipped: number;
  errors: string[];
};

function extOf(path: string): string {
  const i = path.lastIndexOf(".");
  return i >= 0 ? path.slice(i + 1).toLowerCase() : "";
}

function assetTypeForMime(mime: string): "image" | "video" | "document" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/") || mime.startsWith("audio/")) return "video";
  return "document";
}

function safeStorageName(relativePath: string): string {
  return relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
}

function isImportableAssetPath(relativePath: string, ext: string): boolean {
  if (BINARY_EXT.has(ext)) {
    if (ext === "json") return LOTTIE_PATH_RE.test(relativePath);
    return true;
  }
  return false;
}

async function insertProjectMediaAsset(input: {
  admin: SupabaseClient;
  userId: string;
  projectId: string;
  rel: string;
  data: Buffer;
  mime: string;
  result: ZipBinaryImportResult;
}): Promise<void> {
  const storagePath = `${input.userId}/${input.projectId}/imported/${input.rel.replace(/\//g, "__")}`;

  const { error: uploadError } = await input.admin.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, input.data, { contentType: input.mime, upsert: true });
  if (uploadError) {
    input.result.errors.push(`${input.rel}: ${uploadError.message}`);
    return;
  }

  const {
    data: { publicUrl },
  } = input.admin.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath);

  const filename = input.rel.split("/").pop() ?? input.rel;
  const { data: existing } = await input.admin
    .from("media_assets")
    .select("id")
    .eq("project_id", input.projectId)
    .eq("storage_path", storagePath)
    .maybeSingle();
  if (existing?.id) {
    input.result.skipped += 1;
    return;
  }

  const { error: dbError } = await input.admin.from("media_assets").insert({
    user_id: input.userId,
    project_id: input.projectId,
    filename,
    storage_path: storagePath,
    public_url: publicUrl,
    mime_type: input.mime,
    size_bytes: input.data.length,
    asset_type: assetTypeForMime(input.mime),
    generated: false,
    tags: ["zip_import", input.rel],
  } as never);

  if (dbError) {
    input.result.errors.push(`${input.rel}: ${dbError.message}`);
    return;
  }

  input.result.imported += 1;
}

/** Extract binary files from ZIP archive into project media storage. */
export async function importZipBinaryAssets(input: {
  admin: SupabaseClient;
  zipBuffer: Buffer;
  userId: string;
  projectId: string;
}): Promise<ZipBinaryImportResult> {
  const result: ZipBinaryImportResult = { imported: 0, skipped: 0, errors: [] };

  const bucket = await ensurePublicBucket(input.admin, MEDIA_BUCKET);
  if (!bucket.ok) {
    result.errors.push(`media bucket: ${bucket.error}`);
    return result;
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(input.zipBuffer);
  } catch {
    result.errors.push("Could not read ZIP for binary assets");
    return result;
  }

  for (const [rawPath, entry] of Object.entries(zip.files)) {
    if (!entry || entry.dir) continue;

    const normalized = normalizeZipEntryPath(rawPath);
    if (!normalized) {
      result.skipped += 1;
      continue;
    }
    if (shouldSkipZipPath(normalized)) {
      result.skipped += 1;
      continue;
    }
    if (isSecretZipPath(normalized)) {
      result.skipped += 1;
      continue;
    }

    const ext = extOf(normalized);
    if (!isImportableAssetPath(normalized, ext)) {
      result.skipped += 1;
      continue;
    }

    let data: Buffer;
    try {
      data = Buffer.from(await entry.async("arraybuffer"));
    } catch {
      result.skipped += 1;
      continue;
    }

    if (data.length === 0 || data.length > 50 * 1024 * 1024) {
      result.skipped += 1;
      continue;
    }

    const mime = MIME[ext] ?? "application/octet-stream";
    const rel = safeStorageName(normalized);
    await insertProjectMediaAsset({
      admin: input.admin,
      userId: input.userId,
      projectId: input.projectId,
      rel,
      data,
      mime,
      result,
    });
  }

  return result;
}

async function listArtifactPaths(
  admin: SupabaseClient,
  prefix: string,
  acc: string[] = [],
): Promise<string[]> {
  let offset = 0;
  const pageSize = 500;
  for (;;) {
    const { data, error } = await admin.storage.from(PREVIEW_ARTIFACTS_BUCKET).list(prefix, {
      limit: pageSize,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) return acc;
    if (!data?.length) break;
    for (const item of data) {
      if (!item.name) continue;
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      const isFolder = item.id == null;
      if (isFolder) {
        await listArtifactPaths(admin, full, acc);
      } else {
        acc.push(full);
      }
    }
    if (data.length < pageSize) break;
    offset += data.length;
  }
  return acc;
}

/** Copy built preview artifact media (dist/assets) into project storage. */
export async function importPreviewArtifactBinaryAssets(input: {
  admin: SupabaseClient;
  userId: string;
  projectId: string;
  artifactPath: string;
}): Promise<ZipBinaryImportResult> {
  const result: ZipBinaryImportResult = { imported: 0, skipped: 0, errors: [] };
  const bucket = await ensurePublicBucket(input.admin, MEDIA_BUCKET);
  if (!bucket.ok) {
    result.errors.push(`media bucket: ${bucket.error}`);
    return result;
  }

  const paths = await listArtifactPaths(input.admin, input.artifactPath.replace(/\/+$/, ""));
  for (const storagePath of paths) {
    const rel = storagePath.slice(input.artifactPath.length).replace(/^\/+/, "") || storagePath;
    const ext = extOf(rel);
    if (!isImportableAssetPath(rel, ext)) {
      result.skipped += 1;
      continue;
    }
    const { data: blob, error } = await input.admin.storage
      .from(PREVIEW_ARTIFACTS_BUCKET)
      .download(storagePath);
    if (error || !blob) {
      result.skipped += 1;
      continue;
    }
    const data = Buffer.from(await blob.arrayBuffer());
    if (data.length === 0) {
      result.skipped += 1;
      continue;
    }
    await insertProjectMediaAsset({
      admin: input.admin,
      userId: input.userId,
      projectId: input.projectId,
      rel,
      data,
      mime: MIME[ext] ?? "application/octet-stream",
      result,
    });
  }
  return result;
}
