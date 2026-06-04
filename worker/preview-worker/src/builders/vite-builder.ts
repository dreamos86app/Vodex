import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { FrameworkInfo } from "../framework.js";
import { resolveOutputDir } from "../sandbox.js";
import { npmInstall, npmRunBuild } from "./run-command.js";
import { injectPreviewEnvShims, detectLegacy } from "../adapters/base44-adapter.js";
import type { WorkspaceFile } from "../sandbox.js";
import { applyPackageRepair, assertViteBinaryPresent, type PackageRepairSummary } from "../package-repair.js";

export type ViteBuildMeta = {
  installCommand: string;
  buildCommand: string;
  packageManager: string;
  packageRepair: PackageRepairSummary;
};

function formatCmd(meta: { command: string; args: string[] }): string {
  return [meta.command, ...meta.args].join(" ");
}

export async function buildVite(
  root: string,
  framework: FrameworkInfo,
  files: WorkspaceFile[],
): Promise<
  | { ok: true; outputDir: string; logs: string; buildMeta: ViteBuildMeta }
  | { ok: false; logs: string; blockedReason: string; buildMeta: ViteBuildMeta }
> {
  const legacy = detectLegacy(files);
  const packageRepair = await applyPackageRepair(root, files, legacy.base44);

  let logs = `[package-repair]\n${packageRepair.summary}\n`;
  if (packageRepair.repairs.length) {
    logs += packageRepair.repairs.map((r) => `- ${r}`).join("\n") + "\n";
  }

  const preferInstall = packageRepair.viteInjected || packageRepair.pluginReactInjected || packageRepair.viteConfigCreated;

  const install = await npmInstall(root, framework.packageManager, { preferInstall });
  const installCommand = formatCmd(install.meta);
  logs += `[install] ${installCommand}\n${install.logs}\n`;
  if (!install.ok) {
    return {
      ok: false,
      logs,
      blockedReason: "Dependency install failed — devDependencies must install for Vite preview builds",
      buildMeta: {
        installCommand,
        buildCommand: "",
        packageManager: framework.packageManager,
        packageRepair,
      },
    };
  }

  const viteCheck = await assertViteBinaryPresent(root);
  if (!viteCheck.ok) {
    return {
      ok: false,
      logs: `${logs}\n[vite-check] node_modules/.bin/vite not found after install\n`,
      blockedReason: viteCheck.blockedReason,
      buildMeta: {
        installCommand,
        buildCommand: "",
        packageManager: framework.packageManager,
        packageRepair,
      },
    };
  }

  const buildScript = framework.scripts.build ? "build" : "build";
  const build = await npmRunBuild(root, framework.packageManager, buildScript);
  const buildCommand = formatCmd(build.meta);
  logs += `[build] ${buildCommand}\n${build.logs}\n`;

  const buildMeta: ViteBuildMeta = {
    installCommand,
    buildCommand,
    packageManager: framework.packageManager,
    packageRepair,
  };

  if (!build.ok) {
    const hint = /vite:\s*not found|sh:\s*1:\s*vite:/i.test(build.logs)
      ? "Vite CLI was not on PATH — package repair and devDependency install were attempted."
      : "Vite build failed";
    return { ok: false, logs, blockedReason: hint, buildMeta };
  }

  const outKey = framework.id === "cra" ? "cra" : "vite";
  const outDir = resolveOutputDir(outKey, root);
  const indexPath = path.join(outDir, "index.html");
  try {
    let html = await fs.readFile(indexPath, "utf8");
    html = injectPreviewEnvShims(html, legacy);
    await fs.writeFile(indexPath, html, "utf8");
  } catch {
    return {
      ok: false,
      logs: `${logs}\nMissing dist/index.html`,
      blockedReason: "Build output missing index.html",
      buildMeta,
    };
  }
  return { ok: true, outputDir: outDir, logs, buildMeta };
}
