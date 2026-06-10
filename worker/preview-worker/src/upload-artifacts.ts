import * as fs from "node:fs/promises";
import * as path from "node:path";
import { supabase } from "./supabase.js";
import { config } from "./config.js";
import { sanitizeArtifactBuffer } from "./preview-artifact-sanitize.js";

function contentType(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "html") return "text/html; charset=utf-8";
  if (ext === "js" || ext === "mjs") return "application/javascript; charset=utf-8";
  if (ext === "css") return "text/css; charset=utf-8";
  if (ext === "json") return "application/json";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "png") return "image/png";
  if (ext === "woff2") return "font/woff2";
  return "application/octet-stream";
}

async function walk(dir: string, base = dir): Promise<Array<{ rel: string; abs: string }>> {
  const out: Array<{ rel: string; abs: string }> = [];
  for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
    const abs = path.join(dir, ent.name);
    const rel = path.relative(base, abs).replace(/\\/g, "/");
    if (ent.isDirectory()) out.push(...(await walk(abs, base)));
    else if (ent.isFile()) out.push({ rel, abs });
  }
  return out;
}

export async function uploadArtifacts(
  projectId: string,
  jobId: string,
  outputDir: string,
): Promise<{ ok: true; artifactPath: string; fileCount: number } | { ok: false; error: string }> {
  const prefix = `${projectId}/${jobId}`;
  const files = await walk(outputDir);
  let uploaded = 0;
  for (const file of files) {
    const raw = await fs.readFile(file.abs);
    const buf = sanitizeArtifactBuffer(raw, file.rel, projectId);
    const storagePath = `${prefix}/${file.rel}`;
    const { error } = await supabase.storage.from(config.artifactBucket).upload(storagePath, buf, {
      contentType: contentType(file.rel),
      upsert: true,
    });
    if (error) return { ok: false, error: error.message };
    uploaded += 1;
  }
  return { ok: true, artifactPath: prefix, fileCount: uploaded };
}
