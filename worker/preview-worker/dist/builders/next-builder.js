import * as fs from "node:fs/promises";
import * as path from "node:path";
import { resolveOutputDir } from "../sandbox.js";
import { npmInstall, npmRunBuild } from "./run-command.js";
import { injectPreviewEnvShims, detectLegacy } from "../adapters/base44-adapter.js";
export async function buildNext(root, framework, files) {
    if (framework.isSsrNext && !framework.scripts.export) {
        return {
            ok: false,
            logs: "Next SSR detected",
            blockedReason: "Next SSR preview requires persistent runtime mode — static export is not configured for this app",
        };
    }
    let logs = "";
    const install = await npmInstall(root, framework.packageManager, { preferInstall: true });
    logs += `[install] ${install.meta.command} ${install.meta.args.join(" ")}\n${install.logs}\n`;
    if (!install.ok) {
        return { ok: false, logs, blockedReason: "Next.js dependency install failed" };
    }
    const build = await npmRunBuild(root, framework.packageManager, "build");
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
    }
    catch {
        return {
            ok: false,
            logs: `${logs}\nNo static out/index.html — SSR runtime not implemented`,
            blockedReason: "Next SSR preview requires persistent runtime mode — no static export output was produced",
        };
    }
}
