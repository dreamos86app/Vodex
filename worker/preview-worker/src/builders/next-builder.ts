import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { FrameworkInfo } from "../framework.js";
import type { WorkspaceFile } from "../sandbox.js";
import { resolveOutputDir } from "../sandbox.js";
import { npmInstall, npmRunBuild } from "./run-command.js";
import { injectPreviewEnvShims, detectLegacy } from "../adapters/base44-adapter.js";
import { ensureNextStaticExportOnDisk } from "./next-static-export.js";
import { stripPreviewPlatformPathsFromText } from "../preview-artifact-sanitize.js";
import { injectPreviewVirtualHistory } from "../inject-preview-shim.js";

export async function buildNext(
  root: string,
  framework: FrameworkInfo,
  files: WorkspaceFile[],
  projectId: string,
): Promise<
  | { ok: true; outputDir: string; logs: string }
  | { ok: false; logs: string; blockedReason: string }
> {
  let logs = "";
  let frameworkInfo = framework;

  if (framework.isSsrNext && !framework.scripts.export) {
    const patch = await ensureNextStaticExportOnDisk(root);
    logs += patch.logs;
    if (patch.patched) {
      frameworkInfo = { ...framework, isSsrNext: false, hasStaticExport: true };
    } else {
      return {
        ok: false,
        logs: logs || "Next SSR detected",
        blockedReason:
          "Next SSR preview requires persistent runtime mode — static export is not configured for this app",
      };
    }
  }

  const install = await npmInstall(root, frameworkInfo.packageManager, { preferInstall: true });
  logs += `[install] ${install.meta.command} ${install.meta.args.join(" ")}\n${install.logs}\n`;
  if (!install.ok) {
    return { ok: false, logs, blockedReason: "Next.js dependency install failed" };
  }

  const build = await npmRunBuild(root, frameworkInfo.packageManager, "build");
  logs += `[build] ${build.meta.command} ${build.meta.args.join(" ")}\n${build.logs}\n`;
  if (!build.ok) {
    return { ok: false, logs, blockedReason: "Next.js build failed" };
  }

  const outDir = resolveOutputDir("nextjs_app", root);
  const indexPath = path.join(outDir, "index.html");
  try {
    await fs.access(indexPath);
    async function walkHtml(dir: string): Promise<string[]> {
      const found: string[] = [];
      for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
        const abs = path.join(dir, ent.name);
        if (ent.isDirectory()) found.push(...(await walkHtml(abs)));
        else if (ent.isFile() && ent.name.toLowerCase().endsWith(".html")) found.push(abs);
      }
      return found;
    }
    const htmlFiles = await walkHtml(outDir);
    const legacy = detectLegacy(files);
    for (const htmlPath of htmlFiles) {
      const rel = path.relative(outDir, htmlPath).replace(/\\/g, "/");
      const routePath = rel === "index.html" ? "/" : `/${rel.replace(/index\.html$/i, "").replace(/\/$/, "")}`;
      let html = await fs.readFile(htmlPath, "utf8");
      html = stripPreviewPlatformPathsFromText(html, projectId);
      html = injectPreviewEnvShims(html, legacy);
      html = injectPreviewVirtualHistory(html, routePath || "/");
      await fs.writeFile(htmlPath, html, "utf8");
    }
    return { ok: true, outputDir: outDir, logs };
  } catch {
    return {
      ok: false,
      logs: `${logs}\nNo static out/index.html — SSR runtime not implemented`,
      blockedReason:
        "Next SSR preview requires persistent runtime mode — no static export output was produced",
    };
  }
}
