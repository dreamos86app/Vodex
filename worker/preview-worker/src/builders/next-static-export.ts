import * as fs from "node:fs/promises";
import * as path from "node:path";

function patchNextConfigContent(content: string): string {
  if (/output\s*:\s*['"]export['"]/.test(content)) return content;
  if (/export default\s*\{/.test(content)) {
    return content.replace(
      /export default\s*\{/,
      "export default {\n  output: 'export',\n  images: { unoptimized: true },",
    );
  }
  if (/module\.exports\s*=\s*\{/.test(content)) {
    return content.replace(
      /module\.exports\s*=\s*\{/,
      "module.exports = {\n  output: 'export',\n  images: { unoptimized: true },",
    );
  }
  return `${content.trim()}\n/** @type {import('next').NextConfig} */\nconst nextConfig = { output: 'export', images: { unoptimized: true } };\nmodule.exports = nextConfig;\n`;
}

export async function ensureNextStaticExportOnDisk(root: string): Promise<{ patched: boolean; logs: string }> {
  const configNames = ["next.config.mjs", "next.config.js", "next.config.ts"];
  for (const name of configNames) {
    const filePath = path.join(root, name);
    try {
      const content = await fs.readFile(filePath, "utf8");
      const patched = patchNextConfigContent(content);
      if (patched !== content) {
        await fs.writeFile(filePath, patched, "utf8");
        return { patched: true, logs: `Auto-configured static export in ${name}\n` };
      }
      return { patched: false, logs: `${name} already has static export\n` };
    } catch {
      /* try next */
    }
  }

  const mjsPath = path.join(root, "next.config.mjs");
  const created = `/** @type {import('next').NextConfig} */\nconst nextConfig = {\n  output: 'export',\n  images: { unoptimized: true },\n};\nexport default nextConfig;\n`;
  await fs.writeFile(mjsPath, created, "utf8");
  return { patched: true, logs: "Created next.config.mjs with output: 'export'\n" };
}
