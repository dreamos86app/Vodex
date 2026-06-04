import "server-only";

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensurePrivateBucket } from "@/lib/supabase/ensure-storage-bucket";

export const PREVIEW_ARTIFACTS_BUCKET = "preview-artifacts";

import { ZIP_IMPORT_MAX_BYTES } from "@/lib/import/zip-import-limits";

const MAX_ARTIFACT_BYTES = ZIP_IMPORT_MAX_BYTES;

async function walkDir(dir: string, base = dir): Promise<Array<{ rel: string; abs: string }>> {
  const out: Array<{ rel: string; abs: string }> = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const abs = path.join(dir, ent.name);
    const rel = path.relative(base, abs).replace(/\\/g, "/");
    if (ent.isDirectory()) {
      out.push(...(await walkDir(abs, base)));
    } else if (ent.isFile()) {
      out.push({ rel, abs });
    }
  }
  return out;
}

function contentTypeFor(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "html") return "text/html; charset=utf-8";
  if (ext === "js" || ext === "mjs") return "application/javascript; charset=utf-8";
  if (ext === "css") return "text/css; charset=utf-8";
  if (ext === "json") return "application/json; charset=utf-8";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "woff2") return "font/woff2";
  return "application/octet-stream";
}

export async function uploadPreviewArtifacts(input: {
  admin: SupabaseClient;
  projectId: string;
  buildId: string;
  sourceDir: string;
}): Promise<{ ok: true; artifactPath: string; fileCount: number } | { ok: false; error: string }> {
  const bucket = await ensurePrivateBucket(input.admin, PREVIEW_ARTIFACTS_BUCKET, {
    fileSizeLimit: 5 * 1024 * 1024,
  });
  if (!bucket.ok) return { ok: false, error: bucket.error };

  const prefix = `${input.projectId}/${input.buildId}`;
  const files = await walkDir(input.sourceDir);
  let total = 0;
  let uploaded = 0;

  for (const file of files) {
    const buf = await fs.readFile(file.abs);
    total += buf.length;
    if (total > MAX_ARTIFACT_BYTES) {
      return { ok: false, error: "Preview artifact exceeds size limit" };
    }
    const storagePath = `${prefix}/${file.rel}`;
    const { error } = await input.admin.storage.from(PREVIEW_ARTIFACTS_BUCKET).upload(storagePath, buf, {
      contentType: contentTypeFor(file.rel),
      upsert: true,
    });
    if (error) return { ok: false, error: error.message };
    uploaded += 1;
  }

  return { ok: true, artifactPath: prefix, fileCount: uploaded };
}

export async function downloadPreviewArtifactFile(input: {
  admin: SupabaseClient;
  artifactPath: string;
  relativePath: string;
}): Promise<{ data: Buffer; contentType: string } | null> {
  const rel = input.relativePath.replace(/^\/+/, "") || "index.html";
  const storagePath = `${input.artifactPath}/${rel}`;
  const { data, error } = await input.admin.storage
    .from(PREVIEW_ARTIFACTS_BUCKET)
    .download(storagePath);
  if (error || !data) return null;
  const buf = Buffer.from(await data.arrayBuffer());
  return { data: buf, contentType: contentTypeFor(rel) };
}
