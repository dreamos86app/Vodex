import * as fs from "node:fs/promises";
import * as path from "node:path";
import { norm } from "./sandbox.js";
export function packageJsonCandidates(files) {
    return files
        .map((f) => norm(f.path))
        .filter((p) => p === "package.json" || p.endsWith("/package.json"))
        .sort((a, b) => a.split("/").length - b.split("/").length);
}
/** Resolve directory where npm install/build must run (may be nested in ZIP). */
export async function resolveNpmProjectLayout(workspaceRoot, files) {
    const rootPkg = path.join(workspaceRoot, "package.json");
    try {
        await fs.access(rootPkg);
        return {
            workspaceRoot,
            projectRoot: workspaceRoot,
            packageJsonPath: rootPkg,
            packageJsonRelative: "package.json",
        };
    }
    catch {
        /* fall through */
    }
    const candidates = packageJsonCandidates(files);
    for (const rel of candidates) {
        const abs = path.join(workspaceRoot, rel);
        try {
            await fs.access(abs);
            const projectRoot = path.dirname(abs);
            return {
                workspaceRoot,
                projectRoot,
                packageJsonPath: abs,
                packageJsonRelative: rel,
            };
        }
        catch {
            continue;
        }
    }
    return null;
}
