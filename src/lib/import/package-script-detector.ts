import type { ZipImportFile } from "@/lib/import/zip-file-validator";

export type PackageScripts = {
  dev?: string;
  build?: string;
  start?: string;
  test?: string;
  lint?: string;
  all: Record<string, string>;
};

export function detectPackageScripts(files: ZipImportFile[]): PackageScripts {
  const pkg = files.find((f) => f.path === "package.json" || f.path.endsWith("/package.json"));
  if (!pkg) return { all: {} };
  try {
    const j = JSON.parse(pkg.content) as { scripts?: Record<string, string> };
    const all = j.scripts ?? {};
    return {
      all,
      dev: all.dev ?? all["dev:local"],
      build: all.build,
      start: all.start,
      test: all.test,
      lint: all.lint ?? all["lint:fix"],
    };
  } catch {
    return { all: {} };
  }
}

export function detectPackageManager(files: ZipImportFile[]): "npm" | "pnpm" | "yarn" | "bun" | "unknown" {
  if (files.some((f) => f.path === "pnpm-lock.yaml")) return "pnpm";
  if (files.some((f) => f.path === "yarn.lock")) return "yarn";
  if (files.some((f) => f.path === "bun.lockb" || f.path === "bun.lock")) return "bun";
  if (files.some((f) => f.path === "package-lock.json")) return "npm";
  if (files.some((f) => f.path === "package.json")) return "npm";
  return "unknown";
}
