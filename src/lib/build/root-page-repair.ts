import type { AppArchetypeId } from "@/lib/build/app-archetype-classifier";
import {
  gapFillScaffoldForArchetype,
  mergeScaffoldForArchetype,
  replaceStubFilesWithArchetypeScaffold,
} from "@/lib/build/archetype-scaffold-fallback";
import {
  filterRenderableBuildFiles,
  normalizeBuildFilePath,
  type BuildFile,
} from "@/lib/build/generated-file-utils";
import { isGeneratedFileStub } from "@/lib/build/generated-file-stub";
import {
  evaluateSourceIntegrity,
  fileMeetsMeaningfulThreshold,
  type SourceIntegrityReport,
} from "@/lib/build/source-integrity-validator";
import { primaryAppPageHasRealContent } from "@/lib/build/source-integrity-validator";

export function rootPageContentOk(files: BuildFile[]): boolean {
  return primaryAppPageHasRealContent(files);
}

/** Replace model output when stub, redirect-only, or below root-page integrity threshold. */
export function shouldReplaceWithScaffold(path: string, content: string): boolean {
  const normalized = normalizeBuildFilePath(path);
  if (!content?.trim()) return true;
  if (isGeneratedFileStub(content, normalized)) return true;
  if (/^app\/page\.(tsx|jsx)$/i.test(normalized)) {
    return !fileMeetsMeaningfulThreshold({ path: normalized, content });
  }
  if (/^components\/.+\.(tsx|jsx)$/i.test(normalized)) {
    return !fileMeetsMeaningfulThreshold({ path: normalized, content });
  }
  return false;
}

export type RootPageRepairResult = {
  files: BuildFile[];
  rootPageRepaired: boolean;
  deterministicRepairApplied: boolean;
  repairModelAttempted: boolean;
  repairBudgetBlocked: boolean;
  integrityBefore: SourceIntegrityReport;
  integrityAfterRepair: SourceIntegrityReport;
};

export function repairRootPageContent(
  archetypeId: AppArchetypeId,
  files: BuildFile[],
  appName = "Dream App",
  opts?: { repairModelAttempted?: boolean; repairBudgetBlocked?: boolean },
): RootPageRepairResult {
  const integrityBefore = evaluateSourceIntegrity(files);
  const needsRepair =
    !rootPageContentOk(files) ||
    !integrityBefore.sourceIntegrityOk;

  if (!needsRepair) {
    return {
      files,
      rootPageRepaired: false,
      deterministicRepairApplied: false,
      repairModelAttempted: opts?.repairModelAttempted ?? false,
      repairBudgetBlocked: opts?.repairBudgetBlocked ?? false,
      integrityBefore,
      integrityAfterRepair: integrityBefore,
    };
  }

  const rootBefore = files.find((f) =>
    /^app\/page\.(tsx|jsx)$/i.test(normalizeBuildFilePath(f.path)),
  );
  const modelRootAttempt =
    Boolean(rootBefore?.content?.trim()) &&
    !isGeneratedFileStub(rootBefore!.content, rootBefore!.path);

  /** Keep model-authored pages — UI repair pass enriches thin output instead of violet template swap. */
  if (modelRootAttempt) {
    const gapFilled = filterRenderableBuildFiles(
      gapFillScaffoldForArchetype(archetypeId, files, appName),
    );
    const integrityAfterDefer = evaluateSourceIntegrity(gapFilled);
    return {
      files: gapFilled,
      rootPageRepaired: false,
      deterministicRepairApplied: false,
      repairModelAttempted: opts?.repairModelAttempted ?? false,
      repairBudgetBlocked: opts?.repairBudgetBlocked ?? false,
      integrityBefore,
      integrityAfterRepair: integrityAfterDefer,
    };
  }

  let merged = filterRenderableBuildFiles(mergeScaffoldForArchetype(archetypeId, files, appName));
  const stubRepair = replaceStubFilesWithArchetypeScaffold(archetypeId, merged, appName);
  if (stubRepair.replaced > 0) merged = filterRenderableBuildFiles(stubRepair.files);

  const scaffoldTree = filterRenderableBuildFiles(mergeScaffoldForArchetype(archetypeId, [], appName));
  const byPath = new Map(merged.map((f) => [normalizeBuildFilePath(f.path), f]));
  let rootPageRepaired = false;
  for (const scaffoldFile of scaffoldTree) {
    const path = normalizeBuildFilePath(scaffoldFile.path);
    const existing = byPath.get(path);
    if (existing && !shouldReplaceWithScaffold(path, existing.content)) continue;
    if (/^app\/page\.(tsx|jsx)$/i.test(path)) rootPageRepaired = true;
    byPath.set(path, scaffoldFile);
  }
  merged = filterRenderableBuildFiles([...byPath.values()]);
  const integrityAfterRepair = evaluateSourceIntegrity(merged);

  if (process.env.NODE_ENV !== "production") {
    console.info("[build] root_page_repair", {
      archetypeId,
      rootPageRepaired,
      deterministicRepairApplied: true,
      repairModelAttempted: opts?.repairModelAttempted ?? false,
      repairBudgetBlocked: opts?.repairBudgetBlocked ?? false,
      integrityBefore: integrityBefore.blockedReason,
      integrityAfterRepair: integrityAfterRepair.blockedReason,
    });
  }

  return {
    files: merged,
    rootPageRepaired,
    deterministicRepairApplied: true,
    repairModelAttempted: opts?.repairModelAttempted ?? false,
    repairBudgetBlocked: opts?.repairBudgetBlocked ?? false,
    integrityBefore,
    integrityAfterRepair,
  };
}
