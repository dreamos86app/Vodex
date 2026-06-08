/**
 * Ensure generated Next.js apps can preview via static export (worker serves out/index.html).
 */
import type { ZipImportFile } from "@/lib/import/zip-file-validator";

const EXPORT_SNIPPET = `output: 'export'`;
const IMAGES_SNIPPET = `images: { unoptimized: true }`;

function hasStaticExportConfig(content: string): boolean {
  return /output\s*:\s*['"]export['"]/.test(content);
}

function patchNextConfigContent(content: string): string {
  if (hasStaticExportConfig(content)) return content;
  if (/export default\s*\{/.test(content)) {
    return content.replace(
      /export default\s*\{/,
      `export default {\n  ${EXPORT_SNIPPET},\n  ${IMAGES_SNIPPET},`,
    );
  }
  if (/module\.exports\s*=\s*\{/.test(content)) {
    return content.replace(
      /module\.exports\s*=\s*\{/,
      `module.exports = {\n  ${EXPORT_SNIPPET},\n  ${IMAGES_SNIPPET},`,
    );
  }
  return `${content.trim()}\n/** @type {import('next').NextConfig} */\nconst nextConfig = { ${EXPORT_SNIPPET}, ${IMAGES_SNIPPET} };\nmodule.exports = nextConfig;\n`;
}

export function ensureNextStaticExportInFiles(files: ZipImportFile[]): {
  files: ZipImportFile[];
  patched: boolean;
  patchedPaths: string[];
} {
  const nextConfigNames = ["next.config.mjs", "next.config.js", "next.config.ts"];
  const out = files.map((f) => ({ ...f }));
  const patchedPaths: string[] = [];

  for (const name of nextConfigNames) {
    const idx = out.findIndex((f) => f.path.replace(/\\/g, "/") === name);
    if (idx >= 0) {
      const patched = patchNextConfigContent(out[idx]!.content);
      if (patched !== out[idx]!.content) {
        out[idx] = { ...out[idx]!, content: patched };
        patchedPaths.push(name);
      }
      return { files: out, patched: patchedPaths.length > 0, patchedPaths };
    }
  }

  const created = `/** @type {import('next').NextConfig} */\nconst nextConfig = {\n  ${EXPORT_SNIPPET},\n  ${IMAGES_SNIPPET},\n};\nexport default nextConfig;\n`;
  out.push({ path: "next.config.mjs", content: created, sizeBytes: Buffer.byteLength(created, "utf8") });
  patchedPaths.push("next.config.mjs");
  return { files: out, patched: true, patchedPaths };
}

export function isNextSsrStaticExportBlocker(reason: string): boolean {
  const r = reason.toLowerCase();
  return (
    r.includes("ssr preview requires persistent runtime") ||
    r.includes("static export is not configured") ||
    r.includes("no static export output")
  );
}
