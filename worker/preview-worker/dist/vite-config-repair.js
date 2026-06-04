import * as fs from "node:fs/promises";
import * as path from "node:path";
import { norm } from "./sandbox.js";
export const MINIMAL_VITE_CONFIG = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
    minify: "esbuild",
    chunkSizeWarningLimit: 2000,
  },
});
`;
/** Patch or create vite config with memory-safe build defaults. */
export async function ensureMemorySafeViteConfig(projectRoot, files) {
    const configs = files
        .map((f) => norm(f.path))
        .filter((p) => /vite\.config\.(ts|js|mjs|cjs)$/i.test(p));
    if (configs.length === 0) {
        await fs.writeFile(path.join(projectRoot, "vite.config.js"), MINIMAL_VITE_CONFIG, "utf8");
        return { created: true, patched: false };
    }
    const rel = configs.sort((a, b) => a.split("/").length - b.split("/").length)[0];
    const abs = path.join(projectRoot, rel);
    let src;
    try {
        src = await fs.readFile(abs, "utf8");
    }
    catch {
        return { created: false, patched: false };
    }
    let patched = false;
    let next = src;
    if (!/build\s*:\s*\{/.test(next)) {
        next = next.replace(/export default defineConfig\(\s*\{/, `export default defineConfig({
  build: {
    sourcemap: false,
    minify: "esbuild",
    chunkSizeWarningLimit: 2000,
  },`);
        patched = true;
    }
    else {
        if (!/sourcemap\s*:/.test(next)) {
            next = next.replace(/build\s*:\s*\{/, "build: {\n    sourcemap: false,");
            patched = true;
        }
        if (!/minify\s*:/.test(next)) {
            next = next.replace(/build\s*:\s*\{/, 'build: {\n    minify: "esbuild",');
            patched = true;
        }
        if (!/chunkSizeWarningLimit\s*:/.test(next)) {
            next = next.replace(/build\s*:\s*\{/, "build: {\n    chunkSizeWarningLimit: 2000,");
            patched = true;
        }
    }
    if (patched && next !== src) {
        await fs.writeFile(abs, next, "utf8");
    }
    return { created: false, patched };
}
