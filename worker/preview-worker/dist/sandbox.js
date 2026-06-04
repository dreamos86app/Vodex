import * as fs from "node:fs/promises";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";
export function norm(p) {
    return p.replace(/\\/g, "/").replace(/^\.\//, "");
}
export function isSafeRelativePath(rel) {
    const n = norm(rel);
    if (!n || n.startsWith("/") || n.includes(".."))
        return false;
    return true;
}
const IGNORE = [
    /^node_modules\//,
    /^\.git\//,
    /^\.next\//,
    /^dist\//,
    /^build\//,
    /^out\//,
    /^\.turbo\//,
    /^coverage\//,
];
export function shouldIgnorePath(p) {
    const n = norm(p);
    return IGNORE.some((re) => re.test(n));
}
export async function createWorkspace(projectId) {
    const root = path.join(config.workspaceDir, projectId, randomUUID());
    await fs.mkdir(root, { recursive: true });
    return root;
}
export async function writeWorkspaceFiles(root, files) {
    if (files.length > config.maxFiles) {
        throw new Error(`Too many files (${files.length} > ${config.maxFiles})`);
    }
    let total = 0;
    const maxBytes = config.maxSourceMb * 1024 * 1024;
    for (const file of files) {
        if (!isSafeRelativePath(file.path) || shouldIgnorePath(file.path))
            continue;
        const buf = Buffer.from(file.content, "utf8");
        total += buf.length;
        if (total > maxBytes)
            throw new Error("Source exceeds max size");
        const abs = path.join(root, norm(file.path));
        await fs.mkdir(path.dirname(abs), { recursive: true });
        await fs.writeFile(abs, buf);
    }
}
export async function cleanupWorkspace(root) {
    await fs.rm(root, { recursive: true, force: true }).catch(() => { });
}
export function resolveOutputDir(framework, root) {
    if (framework === "cra")
        return path.join(root, "build");
    if (framework.startsWith("next"))
        return path.join(root, "out");
    return path.join(root, "dist");
}
