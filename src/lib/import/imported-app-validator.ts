import type { ZipImportFile } from "@/lib/import/zip-file-validator";
import { detectFramework, detectRoutes } from "@/lib/import/framework-detector";
import { detectPackageScripts, detectPackageManager } from "@/lib/import/package-script-detector";
import { detectDependencies } from "@/lib/import/dependency-detector";
import { detectEnvRequirements } from "@/lib/import/env-requirement-detector";
import { scoreImportQuality } from "@/lib/import/import-quality-score";

export type ImportedAppValidation = {
  valid: boolean;
  blockers: string[];
  warnings: string[];
  framework: ReturnType<typeof detectFramework>;
  routes: string[];
  scripts: ReturnType<typeof detectPackageScripts>;
  packageManager: ReturnType<typeof detectPackageManager>;
  dependencies: ReturnType<typeof detectDependencies>;
  envRequirements: ReturnType<typeof detectEnvRequirements>;
  qualityScore: number;
  previewReady: boolean;
  publishReady: boolean;
};

export function validateImportedApp(
  files: ZipImportFile[],
  opts?: { rejectedSecrets?: string[] },
): ImportedAppValidation {
  const framework = detectFramework(files);
  const routes = detectRoutes(files);
  const scripts = detectPackageScripts(files);
  const packageManager = detectPackageManager(files);
  const dependencies = detectDependencies(files);
  const envRequirements = detectEnvRequirements(files);
  const quality = scoreImportQuality({
    files,
    framework,
    routes,
    scripts,
    dependencies,
    envRequirements,
    rejectedSecrets: opts?.rejectedSecrets ?? [],
  });

  const blockers: string[] = [];
  const warnings: string[] = [];

  if (files.length === 0) blockers.push("No importable files");
  if (framework.id === "unknown" && !files.some((f) => /index\.html$/i.test(f.path))) {
    warnings.push("Framework could not be detected — preview may be limited");
  }
  if (!scripts.build && framework.id !== "static") {
    warnings.push("No build script detected in package.json");
  }
  if (routes.length === 0 && framework.id !== "static") {
    warnings.push("No routes/pages detected");
  }
  if ((opts?.rejectedSecrets?.length ?? 0) > 0) {
    warnings.push(`${opts!.rejectedSecrets!.length} secret/env files excluded from import`);
  }

  const previewReady = quality.total >= 70 && files.length > 0 && blockers.length === 0;
  const publishReady = quality.total >= 85 && routes.length > 0 && blockers.length === 0;

  return {
    valid: blockers.length === 0 && files.length > 0,
    blockers,
    warnings,
    framework,
    routes,
    scripts,
    packageManager,
    dependencies,
    envRequirements,
    qualityScore: quality.total,
    previewReady,
    publishReady,
  };
}
