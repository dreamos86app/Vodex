import { mergeMobileBaselineIntoFiles } from "@/lib/generated-apps/mobile-baseline";
import { runGeneratedMobileQualityChecks } from "@/lib/generated-apps/mobile-quality-checks";
import type { BuildFile } from "@/lib/build/generated-file-utils";

export function injectMobileBaselineIntoBuildFiles(
  files: BuildFile[],
  input: { appName: string; projectId: string; themeColor?: string },
): BuildFile[] {
  const appId = `dev.vodex.${input.projectId.replace(/-/g, "").slice(0, 12)}`;
  const merged = mergeMobileBaselineIntoFiles(files, {
    appName: input.appName,
    appId,
    themeColor: input.themeColor,
  });
  return merged.map((f) => ({ path: f.path, content: f.content }));
}

export function logMobileQualityAfterInject(files: BuildFile[]): void {
  const checks = runGeneratedMobileQualityChecks(files);
  const passed = checks.filter((c) => c.pass).length;
  if (process.env.NODE_ENV !== "production") {
    console.info("[mobile-baseline] quality checks", { passed, total: checks.length, checks });
  }
}
