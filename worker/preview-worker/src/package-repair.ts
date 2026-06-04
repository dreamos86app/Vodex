import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { WorkspaceFile } from "./sandbox.js";
import { norm } from "./sandbox.js";
import { log } from "./logger.js";
import {
  emptyPackageRepairDiagnostics,
  truncateForDiagnostics,
  VITE_BINARY_MISSING_CODE,
  type PackageRepairDiagnostics,
} from "./package-repair-diagnostics.js";
import { ensureMemorySafeViteConfig } from "./vite-config-repair.js";
import type { NpmProjectLayout } from "./resolve-npm-root.js";

export type PackageRepairSummary = PackageRepairDiagnostics & {
  packageManager: "npm" | "pnpm" | "yarn";
  buildUsesVite: boolean;
  base44ShimReady: boolean;
};

type PkgJson = {
  name?: string;
  type?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

function scriptUsesVite(scripts: Record<string, string>): boolean {
  return Object.values(scripts).some((s) => /\bvite\b/i.test(s));
}

function hasDep(deps: Record<string, string>, name: string): boolean {
  return Boolean(deps[name]);
}

function usesReact(files: WorkspaceFile[]): boolean {
  const blob = files.map((f) => f.content).join("\n");
  return (
    /from\s+['"]react['"]/i.test(blob) ||
    files.some((f) => /\.(tsx|jsx)$/i.test(f.path))
  );
}

function usesPluginReact(files: WorkspaceFile[], deps: Record<string, string>): boolean {
  if (hasDep(deps, "@vitejs/plugin-react")) return true;
  const hasViteConfig = files.some((f) => /vite\.config\.(ts|js|mjs)$/i.test(norm(f.path)));
  if (!hasViteConfig) return usesReact(files);
  const cfg = files.find((f) => /vite\.config\.(ts|js|mjs)$/i.test(norm(f.path)))?.content ?? "";
  return /@vitejs\/plugin-react/i.test(cfg) || usesReact(files);
}

export function repairPackageJsonContent(
  raw: string,
  input: { files: WorkspaceFile[]; isBase44: boolean },
): { content: string; summary: Omit<PackageRepairSummary, "packageManager" | "buildUsesVite" | "base44ShimReady"> } {
  const repairs: string[] = [];

  let parsed: PkgJson;
  try {
    parsed = JSON.parse(raw) as PkgJson;
  } catch {
    return {
      content: raw,
      summary: {
        ...emptyPackageRepairDiagnostics(),
        executed: true,
        viteDetectedInOriginal: false,
        originalPackageJson: truncateForDiagnostics(raw),
        finalPackageJson: truncateForDiagnostics(raw),
        repairs: ["package.json parse failed — skipped repair"],
        summary: "package.json invalid",
        errorCode: "PACKAGE_JSON_PARSE_FAILED",
      },
    };
  }

  const scripts = { ...(parsed.scripts ?? {}) };
  const dependencies = { ...(parsed.dependencies ?? {}) };
  const devDependencies = { ...(parsed.devDependencies ?? {}) };
  const allDeps = { ...dependencies, ...devDependencies };
  const viteDetectedInOriginal = hasDep(allDeps, "vite");

  const buildUsesVite = scriptUsesVite(scripts) || input.isBase44;
  const needsVite =
    buildUsesVite || input.isBase44 || Boolean(allDeps["@vitejs/plugin-react"]);

  let viteInjected = false;
  let pluginReactInjected = false;

  if (needsVite && !hasDep(allDeps, "vite")) {
    devDependencies.vite = devDependencies.vite ?? "^5.4.0";
    viteInjected = true;
    repairs.push("Injected vite into devDependencies");
  }

  const wantsReactPlugin = usesPluginReact(input.files, { ...dependencies, ...devDependencies });
  if (wantsReactPlugin && !hasDep({ ...dependencies, ...devDependencies }, "@vitejs/plugin-react")) {
    devDependencies["@vitejs/plugin-react"] = devDependencies["@vitejs/plugin-react"] ?? "^4.3.0";
    pluginReactInjected = true;
    repairs.push("Injected @vitejs/plugin-react into devDependencies");
  }

  if (input.isBase44 && !scripts.build) {
    scripts.build = "vite build";
    repairs.push("Added scripts.build=vite build for Base44 export");
  } else if (buildUsesVite && scripts.build && !/\bvite\b/i.test(scripts.build)) {
    scripts.build = "vite build";
    repairs.push("Normalized scripts.build to vite build");
  } else if (needsVite && !scripts.build) {
    scripts.build = "vite build";
    repairs.push("Added scripts.build=vite build");
  }

  if (input.isBase44 && !scripts.dev) {
    scripts.dev = "vite";
    repairs.push("Added scripts.dev=vite for Base44 preview");
  }

  if (!parsed.type && usesReact(input.files)) {
    parsed.type = "module";
    repairs.push('Set package.json type="module"');
  }

  const content = `${JSON.stringify(
    {
      ...parsed,
      scripts,
      dependencies: Object.keys(dependencies).length ? dependencies : undefined,
      devDependencies: Object.keys(devDependencies).length ? devDependencies : undefined,
    },
    null,
    2,
  )}\n`;

  const repairChanged = content.trim() !== raw.trim();

  return {
    content,
    summary: {
      executed: true,
      repairChanged: repairChanged || viteInjected || pluginReactInjected,
      viteDetectedInOriginal,
      viteInjected,
      pluginReactInjected,
      viteConfigCreated: false,
      packageJsonRelative: null,
      projectRoot: null,
      originalPackageJson: truncateForDiagnostics(raw),
      finalPackageJson: truncateForDiagnostics(content),
      beforeInstall: {
        buildScript: scripts.build ?? null,
        dependencies,
        devDependencies,
      },
      afterInstall: null,
      repairs,
      summary: repairs.length ? repairs.join("; ") : "No package.json changes needed",
      errorCode: null,
    },
  };
}

export async function applyPackageRepair(
  layout: NpmProjectLayout,
  files: WorkspaceFile[],
  isBase44: boolean,
): Promise<PackageRepairSummary> {
  const { packageJsonPath, projectRoot, packageJsonRelative } = layout;
  const paths = files.map((f) => norm(f.path));
  const pm = paths.includes("pnpm-lock.yaml")
    ? "pnpm"
    : paths.includes("yarn.lock")
      ? "yarn"
      : "npm";

  let summary: PackageRepairSummary = {
    ...emptyPackageRepairDiagnostics(),
    packageManager: pm,
    buildUsesVite: false,
    base44ShimReady: isBase44,
    packageJsonRelative,
    projectRoot,
  };

  try {
    const raw = await fs.readFile(packageJsonPath, "utf8");
    log("info", "package-repair: original package.json", {
      packageJsonRelative,
      projectRoot,
      body: truncateForDiagnostics(raw, 4000),
    });

    const repaired = repairPackageJsonContent(raw, { files, isBase44 });
    await fs.writeFile(packageJsonPath, repaired.content, "utf8");
    summary = {
      ...repaired.summary,
      packageManager: pm,
      buildUsesVite: scriptUsesVite(
        (JSON.parse(repaired.content) as PkgJson).scripts ?? {},
      ),
      base44ShimReady: isBase44,
      packageJsonRelative,
      projectRoot,
    };

    if (summary.buildUsesVite || summary.viteInjected) {
      const viteCfg = await ensureMemorySafeViteConfig(projectRoot, files);
      if (viteCfg.created) {
        summary.viteConfigCreated = true;
        summary.repairChanged = true;
        summary.repairs.push("Created minimal vite.config.js (sourcemap off, esbuild minify)");
      } else if (viteCfg.patched) {
        summary.repairChanged = true;
        summary.repairs.push("Patched vite.config build options for preview memory");
      }
      summary.summary = summary.repairs.join("; ");
    }

    log("info", "package-repair: completed", {
      executed: summary.executed,
      repairChanged: summary.repairChanged,
      viteDetectedInOriginal: summary.viteDetectedInOriginal,
      viteInjected: summary.viteInjected,
      pluginReactInjected: summary.pluginReactInjected,
      viteConfigCreated: summary.viteConfigCreated,
      packageJsonRelative,
      projectRoot,
      finalPackageJson: summary.finalPackageJson,
    });
  } catch (e) {
    summary.executed = false;
    summary.repairs.push(
      e instanceof Error ? e.message : "package.json missing — skipped repair",
    );
    summary.summary = summary.repairs.join("; ");
    summary.errorCode = "PACKAGE_JSON_NOT_FOUND";
    log("error", "package-repair: failed", {
      packageJsonRelative,
      projectRoot,
      error: summary.summary,
    });
  }

  return summary;
}

export async function listNodeModulesBin(projectRoot: string): Promise<string[]> {
  const binDir = path.join(projectRoot, "node_modules", ".bin");
  try {
    const entries = await fs.readdir(binDir);
    return entries.sort();
  } catch {
    return [];
  }
}

export async function viteBinaryExists(projectRoot: string): Promise<boolean> {
  const binUnix = path.join(projectRoot, "node_modules", ".bin", "vite");
  const binWin = `${binUnix}.cmd`;
  for (const p of [binUnix, binWin]) {
    try {
      await fs.access(p);
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

export async function assertViteBinaryPresent(
  projectRoot: string,
  diagnostics: PackageRepairDiagnostics,
): Promise<{ ok: true; diagnostics: PackageRepairDiagnostics } | { ok: false; blockedReason: string; diagnostics: PackageRepairDiagnostics }> {
  const binListing = await listNodeModulesBin(projectRoot);
  const exists = await viteBinaryExists(projectRoot);
  const afterInstall = { binListing, viteBinaryExists: exists };
  const next = { ...diagnostics, afterInstall };

  log("info", "package-repair: post-install binary check", {
    viteBinaryExists: exists,
    binCount: binListing.length,
    binListing: binListing.slice(0, 40),
    hasViteInListing: binListing.some((b) => b === "vite" || b.startsWith("vite")),
  });

  if (!exists) {
    next.errorCode = VITE_BINARY_MISSING_CODE;
    log("error", VITE_BINARY_MISSING_CODE, { projectRoot, binListing: binListing.slice(0, 80) });
    return {
      ok: false,
      blockedReason: VITE_BINARY_MISSING_CODE,
      diagnostics: next,
    };
  }
  return { ok: true, diagnostics: next };
}
