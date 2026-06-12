import JSZip from "jszip";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeZipEntryPath,
  shouldSkipZipPath,
  isSecretZipPath,
} from "@/lib/import/zip-file-validator";
import { ensurePublicBucket } from "@/lib/supabase/ensure-storage-bucket";
import { PREVIEW_ARTIFACTS_BUCKET } from "@/lib/imports/preview-artifact-storage";
import { insertMediaAssetRow } from "@/lib/import/insert-media-asset-row";
import {
  collectReferencedAssetPaths,
  zipEntryMatchesReference,
} from "@/lib/import/collect-referenced-asset-paths";
import { listStorageFilePaths } from "@/lib/import/list-storage-file-paths";

const BINARY_EXT = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
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
  "ripo",
]);

const LOTTIE_PATH_RE = /lottie|animation|ripo|motion|splash|welcome|loader|hero|icon|logo|font|media|static/i;

const SOURCE_CODE_EXT = new Set([
  "ts",
  "tsx",
  "jsx",
  "js",
  "mjs",
  "cjs",
  "vue",
  "svelte",
  "md",
  "mdx",
  "css",
  "scss",
  "sass",
  "less",
  "html",
  "htm",
  "map",
]);

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
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
  ripo: "application/json",
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

function isImportableAssetPath(relativePath: string, ext: string, referenced?: Set<string>): boolean {
  const lower = relativePath.toLowerCase();

  if (referenced?.size && zipEntryMatchesReference(relativePath, referenced)) {
    return true;
  }

  if (SOURCE_CODE_EXT.has(ext)) {
    if (/^public\//i.test(lower) || /\/assets?\//i.test(lower)) return BINARY_EXT.has(ext);
    return false;
  }

  if (BINARY_EXT.has(ext)) {
    if (ext === "json" || ext === "ripo") {
      if (LOTTIE_PATH_RE.test(relativePath)) return true;
      if (/^public\//i.test(lower)) return true;
      if (/^\.well-known\//i.test(lower)) return true;
      if (/^static\//i.test(lower)) return true;
      if (/^media\//i.test(lower)) return true;
      if (/^resources\//i.test(lower)) return true;
      if (/\/assets?\//i.test(lower)) return true;
      if (/^src\/assets\//i.test(lower)) return true;
      if (/^src\//i.test(lower) && /lottie|animation|ripo|manifest|icon|splash|welcome|loader/i.test(lower)) {
        return true;
      }
      return false;
    }
    if (/^public\//i.test(lower)) return true;
    if (/^static\//i.test(lower)) return true;
    if (/^media\//i.test(lower)) return true;
    if (/^src\/assets\//i.test(lower)) return true;
    if (/\/assets?\//i.test(lower)) return true;
    if (/^src\//i.test(lower) && /image|icon|logo|font|media|animation|ripo|lottie/i.test(lower)) {
      return true;
    }
    return true;
  }
  return false;
}

function isArtifactMediaFile(relativePath: string): boolean {
  const ext = extOf(relativePath);
  if (SOURCE_CODE_EXT.has(ext)) return false;
  if (ext === "js" || ext === "css" || ext === "map") return false;
  if (BINARY_EXT.has(ext)) return true;
  if (ext === "txt") return false;
  return /\.(png|jpe?g|gif|webp|svg|ico|woff2?|ttf|otf|ripo|json|mp4|webm|mp3|wav|avif)$/i.test(relativePath);
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

  const inserted = await insertMediaAssetRow(input.admin, {
    userId: input.userId,
    projectId: input.projectId,
    filename,
    storagePath,
    publicUrl,
    mimeType: input.mime,
    sizeBytes: input.data.length,
    zipImportPath: input.rel,
    assetType: assetTypeForMime(input.mime),
  });

  if (!inserted.ok) {
    input.result.errors.push(`${input.rel}: ${inserted.error}`);
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
  referencedPaths?: Set<string>;
  appFiles?: Array<{ path: string; content: string }>;
}): Promise<ZipBinaryImportResult> {
  const result: ZipBinaryImportResult = { imported: 0, skipped: 0, errors: [] };

  const referenced =
    input.referencedPaths ??
    (input.appFiles?.length ? collectReferencedAssetPaths(input.appFiles) : new Set<string>());

  const bucket = await ensurePublicBucket(input.admin, MEDIA_BUCKET, {
    fileSizeLimit: 50 * 1024 * 1024,
  });
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
    if (!isImportableAssetPath(normalized, ext, referenced)) {
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
): Promise<string[]> {
  return listStorageFilePaths(admin, PREVIEW_ARTIFACTS_BUCKET, prefix.replace(/\/+$/, ""));
}

/** Copy built preview artifact media (dist/assets) into project storage. */
export async function importPreviewArtifactBinaryAssets(input: {
  admin: SupabaseClient;
  userId: string;
  projectId: string;
  artifactPath: string;
}): Promise<ZipBinaryImportResult> {
  const result: ZipBinaryImportResult = { imported: 0, skipped: 0, errors: [] };
  const bucket = await ensurePublicBucket(input.admin, MEDIA_BUCKET, {
    fileSizeLimit: 50 * 1024 * 1024,
  });
  if (!bucket.ok) {
    result.errors.push(`media bucket: ${bucket.error}`);
    return result;
  }

  const paths = await listArtifactPaths(input.admin, input.artifactPath.replace(/\/+$/, ""));
  for (const storagePath of paths) {
    const rel = storagePath.slice(input.artifactPath.length).replace(/^\/+/, "") || storagePath;
    const ext = extOf(rel);
    if (!isArtifactMediaFile(rel)) {
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
