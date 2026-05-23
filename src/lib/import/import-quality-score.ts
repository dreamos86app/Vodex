import type { ZipImportFile } from "@/lib/import/zip-file-validator";
import type { DetectedFramework } from "@/lib/import/framework-detector";
import type { PackageScripts } from "@/lib/import/package-script-detector";
import type { DependencySummary } from "@/lib/import/dependency-detector";
import type { EnvRequirement } from "@/lib/import/env-requirement-detector";

export type ImportQualityInput = {
  files: ZipImportFile[];
  framework: DetectedFramework;
  routes: string[];
  scripts: PackageScripts;
  dependencies: DependencySummary;
  envRequirements: EnvRequirement[];
  rejectedSecrets: string[];
};

export type ImportQualityBreakdown = {
  total: number;
  frameworkDetection: number;
  scriptsDetected: number;
  routesDetected: number;
  filesValid: number;
  noSecrets: number;
  dependenciesDetected: number;
  envDetected: number;
  structureComplete: number;
};

function clamp(n: number, max = 100): number {
  return Math.max(0, Math.min(max, Math.round(n)));
}

export function scoreImportQuality(input: ImportQualityInput): ImportQualityBreakdown {
  const frameworkDetection = clamp(input.framework.confidence * 100);
  const scriptsDetected = clamp(
    (input.scripts.build ? 40 : 0) + (input.scripts.dev ? 30 : 0) + (input.scripts.start ? 20 : 0) + 10,
  );
  const routesDetected = clamp(
    input.routes.length === 0 ? 15 : input.routes.length >= 2 ? 100 : 85,
  );
  const hasPkg = input.files.some((f) => /package\.json$/i.test(f.path));
  const srcFiles = input.files.filter((f) => /\.(tsx?|jsx?|html|css|json)$/i.test(f.path)).length;
  const filesValid = clamp(
    hasPkg && srcFiles >= 2 ? Math.min(100, 78 + srcFiles * 3) : Math.min(100, 35 + input.files.length * 2),
  );
  const noSecrets = input.rejectedSecrets.length === 0 ? 100 : clamp(100 - input.rejectedSecrets.length * 15);
  const dependenciesDetected = clamp(
    (input.dependencies.production.length > 0 ? 50 : 0) +
      (input.dependencies.hasSupabase || input.dependencies.hasTailwind ? 25 : 0) +
      25,
  );
  const envDetected = clamp(input.envRequirements.length > 0 ? 85 : hasPkg ? 55 : 40);
  const structureComplete = clamp(
    (hasPkg ? 35 : 0) +
      (input.files.some((f) => /page\.(tsx|jsx)/i.test(f.path) || /index\.html$/i.test(f.path)) ? 40 : 0) +
      (input.routes.length > 0 ? 25 : 10),
  );

  const total = clamp(
    frameworkDetection * 0.15 +
      scriptsDetected * 0.12 +
      routesDetected * 0.14 +
      filesValid * 0.12 +
      noSecrets * 0.1 +
      dependenciesDetected * 0.1 +
      envDetected * 0.08 +
      structureComplete * 0.19,
  );

  return {
    total,
    frameworkDetection,
    scriptsDetected,
    routesDetected,
    filesValid,
    noSecrets,
    dependenciesDetected,
    envDetected,
    structureComplete,
  };
}
