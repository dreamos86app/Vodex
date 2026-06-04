import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { WorkspaceFile } from "./sandbox.js";
import { norm } from "./sandbox.js";

export type PackageRepairSummary = {
  packageManager: "npm" | "pnpm" | "yarn";
  buildUsesVite: boolean;
  viteInjected: boolean;
  pluginReactInjected: boolean;
  viteConfigCreated: boolean;
  base44ShimReady: boolean;
  repairs: string[];
  summary: string;
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
): { content: string; summary: PackageRepairSummary } {
  const repairs: string[] = [];
  let parsed: PkgJson;
  try {
    parsed = JSON.parse(raw) as PkgJson;
  } catch {
    return {
      content: raw,
      summary: {
        packageManager: "npm",
        buildUsesVite: false,
        viteInjected: false,
        pluginReactInjected: false,
        viteConfigCreated: false,
        base44ShimReady: input.isBase44,
        repairs: ["package.json parse failed — skipped repair"],
        summary: "package.json invalid",
      },
    };
  }

  const scripts = { ...(parsed.scripts ?? {}) };
  const dependencies = { ...(parsed.dependencies ?? {}) };
  const devDependencies = { ...(parsed.devDependencies ?? {}) };
  const allDeps = { ...dependencies, ...devDependencies };

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

  const paths = input.files.map((f) => norm(f.path));
  const pm = paths.includes("pnpm-lock.yaml")
    ? "pnpm"
    : paths.includes("yarn.lock")
      ? "yarn"
      : "npm";

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

  const summary: PackageRepairSummary = {
    packageManager: pm,
    buildUsesVite: buildUsesVite || needsVite,
    viteInjected,
    pluginReactInjected,
    viteConfigCreated: false,
    base44ShimReady: input.isBase44,
    repairs,
    summary: repairs.length ? repairs.join("; ") : "No package.json changes needed",
  };

  return { content, summary };
}

export async function applyPackageRepair(
  root: string,
  files: WorkspaceFile[],
  isBase44: boolean,
): Promise<PackageRepairSummary> {
  const pkgPath = path.join(root, "package.json");
  let summary: PackageRepairSummary = {
    packageManager: "npm",
    buildUsesVite: false,
    viteInjected: false,
    pluginReactInjected: false,
    viteConfigCreated: false,
    base44ShimReady: isBase44,
    repairs: [],
    summary: "No package.json in archive",
  };

  try {
    const raw = await fs.readFile(pkgPath, "utf8");
    const repaired = repairPackageJsonContent(raw, { files, isBase44 });
    await fs.writeFile(pkgPath, repaired.content, "utf8");
    summary = repaired.summary;

    const hasViteConfig = files.some((f) => /vite\.config\.(ts|js|mjs)$/i.test(norm(f.path)));
    if ((summary.buildUsesVite || summary.viteInjected) && !hasViteConfig && usesReact(files)) {
      const configPath = path.join(root, "vite.config.js");
      await fs.writeFile(
        configPath,
        `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
`,
        "utf8",
      );
      summary.viteConfigCreated = true;
      summary.repairs.push("Created minimal vite.config.js");
      summary.summary = summary.repairs.join("; ");
    }
  } catch {
    summary.repairs.push("package.json missing — skipped repair");
    summary.summary = summary.repairs.join("; ");
  }

  return summary;
}

export async function assertViteBinaryPresent(
  root: string,
): Promise<{ ok: true } | { ok: false; blockedReason: string }> {
  const binUnix = path.join(root, "node_modules", ".bin", "vite");
  const binWin = `${binUnix}.cmd`;
  for (const p of [binUnix, binWin]) {
    try {
      await fs.access(p);
      return { ok: true };
    } catch {
      /* try next */
    }
  }
  return {
    ok: false,
    blockedReason: "Vite dependency missing after install",
  };
}
