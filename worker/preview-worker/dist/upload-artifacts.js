import * as fs from "node:fs/promises";
import * as path from "node:path";
import { supabase } from "./supabase.js";
import { config } from "./config.js";
function contentType(filePath) {
    const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
    if (ext === "html")
        return "text/html; charset=utf-8";
    if (ext === "js" || ext === "mjs")
        return "application/javascript; charset=utf-8";
    if (ext === "css")
        return "text/css; charset=utf-8";
    if (ext === "json")
        return "application/json";
    if (ext === "svg")
        return "image/svg+xml";
    if (ext === "png")
        return "image/png";
    if (ext === "woff2")
        return "font/woff2";
    return "application/octet-stream";
}
async function walk(dir, base = dir) {
    const out = [];
    for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
        const abs = path.join(dir, ent.name);
        const rel = path.relative(base, abs).replace(/\\/g, "/");
        if (ent.isDirectory())
            out.push(...(await walk(abs, base)));
        else if (ent.isFile())
            out.push({ rel, abs });
    }
    return out;
}
export async function uploadArtifacts(projectId, jobId, outputDir) {
    const prefix = `${projectId}/${jobId}`;
    const files = await walk(outputDir);
    let uploaded = 0;
    for (const file of files) {
        const buf = await fs.readFile(file.abs);
        const storagePath = `${prefix}/${file.rel}`;
        const { error } = await supabase.storage.from(config.artifactBucket).upload(storagePath, buf, {
            contentType: contentType(file.rel),
            upsert: true,
        });
        if (error)
            return { ok: false, error: error.message };
        uploaded += 1;
    }
    return { ok: true, artifactPath: prefix, fileCount: uploaded };
}
