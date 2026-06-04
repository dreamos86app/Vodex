/** Shared diagnostic shape persisted on preview_build_jobs.diagnostics */
export type PackageRepairDiagnostics = {
  executed: boolean;
  repairChanged: boolean;
  viteDetectedInOriginal: boolean;
  viteInjected: boolean;
  pluginReactInjected: boolean;
  viteConfigCreated: boolean;
  packageJsonRelative: string | null;
  projectRoot: string | null;
  originalPackageJson: string | null;
  finalPackageJson: string | null;
  beforeInstall: {
    buildScript: string | null;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  } | null;
  afterInstall: {
    binListing: string[];
    viteBinaryExists: boolean;
  } | null;
  repairs: string[];
  summary: string;
  errorCode: string | null;
};

export const VITE_BINARY_MISSING_CODE = "VITE_BINARY_MISSING_AFTER_INSTALL";

export function truncateForDiagnostics(text: string, max = 12_000): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n…[truncated]`;
}

export function emptyPackageRepairDiagnostics(): PackageRepairDiagnostics {
  return {
    executed: false,
    repairChanged: false,
    viteDetectedInOriginal: false,
    viteInjected: false,
    pluginReactInjected: false,
    viteConfigCreated: false,
    packageJsonRelative: null,
    projectRoot: null,
    originalPackageJson: null,
    finalPackageJson: null,
    beforeInstall: null,
    afterInstall: null,
    repairs: [],
    summary: "not run",
    errorCode: null,
  };
}
