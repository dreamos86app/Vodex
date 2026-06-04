import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { FrameworkInfo } from "../framework.js";
import { resolveOutputDir } from "../sandbox.js";
import { npmInstall, npmRunBuild, runViteBuild } from "./run-command.js";
import { injectPreviewEnvShims, detectLegacy } from "../adapters/base44-adapter.js";
import type { WorkspaceFile } from "../sandbox.js";
import {
  applyPackageRepair,
  assertViteBinaryPresent,
  type PackageRepairSummary,
} from "../package-repair.js";
import { VITE_BINARY_MISSING_CODE } from "../package-repair-diagnostics.js";
import { resolveNpmProjectLayout, packageJsonCandidates } from "../resolve-npm-root.js";
import { log } from "../logger.js";

export type ViteBuildMeta = {
  installCommand: string;
  buildCommand: string;
  packageManager: string;
  npmProjectRoot: string;
  packageJsonRelative: string | null;
  packageJsonCandidates: string[];
  packageRepair: PackageRepairSummary;
  frameworkId: string;
};

function formatCmd(meta: { command: string; args: string[] }): string {
  return [meta.command, ...meta.args].join(" ");
}

export async function buildVite(
  workspaceRoot: string,
  framework: FrameworkInfo,
  files: WorkspaceFile[],
): Promise<
  | { ok: true; outputDir: string; logs: string; buildMeta: ViteBuildMeta }
  | { ok: false; logs: string; blockedReason: string; buildMeta: ViteBuildMeta }
> {
  const legacy = detectLegacy(files);
  const pkgCandidates = packageJsonCandidates(files);

  log("info", "vite-builder: start", {
    frameworkId: framework.id,
    packageManager: framework.packageManager,
    packageJsonCandidates: pkgCandidates,
    workspaceRoot,
    isBase44: legacy.base44,
  });

  const layout = await resolveNpmProjectLayout(workspaceRoot, files);
  if (!layout) {
    const buildMeta: ViteBuildMeta = {
      installCommand: "",
      buildCommand: "",
      packageManager: framework.packageManager,
      npmProjectRoot: workspaceRoot,
      packageJsonRelative: null,
      packageJsonCandidates: pkgCandidates,
      packageRepair: {
        executed: false,
        repairChanged: false,
        viteDetectedInOriginal: false,
        viteInjected: false,
        pluginReactInjected: false,
        viteConfigCreated: false,
        packageJsonRelative: null,
        projectRoot: workspaceRoot,
        originalPackageJson: null,
        finalPackageJson: null,
        beforeInstall: null,
        afterInstall: null,
        repairs: ["No package.json found in workspace"],
        summary: "No package.json found",
        errorCode: "PACKAGE_JSON_NOT_FOUND",
        packageManager: framework.packageManager,
        buildUsesVite: false,
        base44ShimReady: legacy.base44,
      },
      frameworkId: framework.id,
    };
    return {
      ok: false,
      logs: "[vite-builder] No package.json in workspace\n",
      blockedReason: "No package.json found for npm build",
      buildMeta,
    };
  }

  const { projectRoot } = layout;
  let packageRepair = await applyPackageRepair(layout, files, legacy.base44);

  let logs = `[package-repair] executed=${packageRepair.executed} repairChanged=${packageRepair.repairChanged} viteDetected=${packageRepair.viteDetectedInOriginal} viteInjected=${packageRepair.viteInjected}\n`;
  logs += `${packageRepair.summary}\n`;
  logs += `npm project root: ${projectRoot}\n`;
  logs += `package.json: ${layout.packageJsonRelative}\n`;
  if (packageRepair.repairs.length) {
    logs += `${packageRepair.repairs.map((r) => `- ${r}`).join("\n")}\n`;
  }

  if (packageRepair.beforeInstall) {
    log("info", "vite-builder: before install", {
      projectRoot,
      buildScript: packageRepair.beforeInstall.buildScript,
      dependencyKeys: Object.keys(packageRepair.beforeInstall.dependencies),
      devDependencyKeys: Object.keys(packageRepair.beforeInstall.devDependencies),
      hasViteInDevDeps: Boolean(packageRepair.beforeInstall.devDependencies.vite),
      hasViteInDeps: Boolean(packageRepair.beforeInstall.dependencies.vite),
    });
    logs += `[pre-install] build=${packageRepair.beforeInstall.buildScript ?? "—"} devDeps=${Object.keys(packageRepair.beforeInstall.devDependencies).join(",") || "—"}\n`;
  }

  const preferInstall =
    packageRepair.repairChanged ||
    packageRepair.viteInjected ||
    packageRepair.pluginReactInjected ||
    packageRepair.viteConfigCreated;

  const install = await npmInstall(projectRoot, framework.packageManager, { preferInstall });
  const installCommand = formatCmd(install.meta);
  logs += `[install] cwd=${projectRoot} ${installCommand}\n${install.logs}\n`;
  if (!install.ok) {
    packageRepair = { ...packageRepair, errorCode: "INSTALL_FAILED" };
    return {
      ok: false,
      logs,
      blockedReason: "Dependency install failed — devDependencies must install for Vite preview builds",
      buildMeta: {
        installCommand,
        buildCommand: "",
        packageManager: framework.packageManager,
        npmProjectRoot: projectRoot,
        packageJsonRelative: layout.packageJsonRelative,
        packageJsonCandidates: pkgCandidates,
        packageRepair,
        frameworkId: framework.id,
      },
    };
  }

  const viteCheck = await assertViteBinaryPresent(projectRoot, packageRepair);
  packageRepair = viteCheck.diagnostics as PackageRepairSummary;
  logs += `[post-install] viteBinaryExists=${packageRepair.afterInstall?.viteBinaryExists ?? false}\n`;
  logs += `[post-install] .bin: ${(packageRepair.afterInstall?.binListing ?? []).slice(0, 60).join(", ")}\n`;

  if (!viteCheck.ok) {
    return {
      ok: false,
      logs: `${logs}\n[vite-check] ${VITE_BINARY_MISSING_CODE}\n`,
      blockedReason: VITE_BINARY_MISSING_CODE,
      buildMeta: {
        installCommand,
        buildCommand: "",
        packageManager: framework.packageManager,
        npmProjectRoot: projectRoot,
        packageJsonRelative: layout.packageJsonRelative,
        packageJsonCandidates: pkgCandidates,
        packageRepair,
        frameworkId: framework.id,
      },
    };
  }

  const buildScript = framework.scripts.build ? "build" : "build";
  const build = await runViteBuild(projectRoot, framework.packageManager, buildScript);
  const buildCommand = formatCmd(build.meta);
  logs += `[build] ${buildCommand}\n${build.logs}\n`;

  const buildMeta: ViteBuildMeta = {
    installCommand,
    buildCommand,
    packageManager: framework.packageManager,
    npmProjectRoot: projectRoot,
    packageJsonRelative: layout.packageJsonRelative,
    packageJsonCandidates: pkgCandidates,
    packageRepair,
    frameworkId: framework.id,
  };

  log("info", "vite-builder: build finished", {
    ok: build.ok,
    buildCommand,
    blockedReason: build.ok ? null : build.logs.slice(0, 200),
  });

  if (!build.ok) {
    const hint = /vite:\s*not found|sh:\s*1:\s*vite:/i.test(build.logs)
      ? VITE_BINARY_MISSING_CODE
      : "Vite build failed";
    return { ok: false, logs, blockedReason: hint, buildMeta };
  }

  const outKey = framework.id === "cra" ? "cra" : "vite";
  const outDir = resolveOutputDir(outKey, projectRoot);
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
