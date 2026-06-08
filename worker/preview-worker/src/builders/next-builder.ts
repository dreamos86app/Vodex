import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { FrameworkInfo } from "../framework.js";
import type { WorkspaceFile } from "../sandbox.js";
import { resolveOutputDir } from "../sandbox.js";
import { npmInstall, npmRunBuild } from "./run-command.js";
import { injectPreviewEnvShims, detectLegacy } from "../adapters/base44-adapter.js";
import { ensureNextStaticExportOnDisk } from "./next-static-export.js";

export async function buildNext(
  root: string,
  framework: FrameworkInfo,
  files: WorkspaceFile[],
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
    let html = await fs.readFile(indexPath, "utf8");
    html = injectPreviewEnvShims(html, detectLegacy(files));
    await fs.writeFile(indexPath, html, "utf8");
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
