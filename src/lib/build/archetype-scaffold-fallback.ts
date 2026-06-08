import type { AppArchetypeId } from "@/lib/build/app-archetype-classifier";
import {
  countRenderablePages,
  filterRenderableBuildFiles,
  normalizeBuildFilePath,
  type BuildFile,
} from "@/lib/build/generated-file-utils";
import { countComponentFiles } from "@/lib/build/import-graph";
import { mergeRestaurantInventoryScaffold } from "@/lib/build/restaurant-inventory-scaffold";
import { mergeSubscriptionBoxScaffold } from "@/lib/build/subscription-box-scaffold";
import { mergeMentalWellnessScaffold } from "@/lib/build/mental-wellness-scaffold";
import { isGeneratedFileStub } from "@/lib/build/generated-file-stub";
import {
  mergeGenericSaaSScaffold,
  mergeGenericSaaSScaffoldGapFill,
} from "@/lib/build/generic-saas-scaffold";
import {
  MIN_RENDERABLE_FILES,
  MIN_ROUTE_PAGES,
} from "@/lib/build/build-success-contract";
import {
  evaluateSourceIntegrity,
  fileMeetsMeaningfulThreshold,
} from "@/lib/build/source-integrity-validator";
import { rootPageContentOk } from "@/lib/build/root-page-repair";
import { mergeNonprofitCrmScaffold } from "@/lib/build/nonprofit-crm-scaffold";
import { isProductionBuildMode } from "@/lib/build/build-production-mode";
import {
  STANDARD_MIN_COMPONENTS,
  STANDARD_MIN_RENDERABLE_FILES,
} from "@/lib/build/post-build-contract";

export type ScaffoldFallbackReason =
  | "llm_returned_no_files"
  | "llm_output_too_weak"
  | "below_minimum_renderable"
  | "below_minimum_components"
  | "below_minimum_routes"
  | "not_needed";

export type ScaffoldFallbackResult = {
  files: BuildFile[];
  usedFallback: boolean;
  reason: ScaffoldFallbackReason;
  beforeCount: number;
  afterCount: number;
  componentCount: number;
  pageCount: number;
  archetypeId: AppArchetypeId;
  filesAdded: number;
  filesReplaced: number;
  stubsReplaced: number;
  rootPageReplaced: boolean;
  sourceBytesBefore: number;
  sourceBytesAfter: number;
  integrityBefore: boolean;
  integrityAfter: boolean;
};

const KNOWN_SCAFFOLD_ARCHETYPES = new Set<AppArchetypeId>([
  "mental_wellness_journal",
  "subscription_box_manager",
  "restaurant_inventory",
  "saas_dashboard",
  "crm",
  "booking",
  "finance_tracker",
  "ecommerce",
  "marketplace",
  "customer_support",
  "admin_panel",
  "ai_tool",
  "project_management",
  "health_wellness",
  "generic_app",
]);

/** Archetypes with a full deterministic file tree in-repo (expand over time). */
const FULL_SCAFFOLD_ARCHETYPES = new Set<AppArchetypeId>([
  "mental_wellness_journal",
  "subscription_box_manager",
  "restaurant_inventory",
  "saas_dashboard",
  "crm",
  "booking",
  "finance_tracker",
  "marketplace",
  "admin_panel",
  "ai_tool",
  "health_wellness",
  "generic_app",
]);

export function hasDeterministicScaffold(archetypeId: string): boolean {
  return KNOWN_SCAFFOLD_ARCHETYPES.has(archetypeId as AppArchetypeId);
}

export function hasFullScaffoldTree(archetypeId: string): boolean {
  return FULL_SCAFFOLD_ARCHETYPES.has(archetypeId as AppArchetypeId);
}

/** Replace stub/TODO model files with deterministic scaffold before contract validation. */
export function replaceStubFilesWithArchetypeScaffold(
  archetypeId: AppArchetypeId,
  files: BuildFile[],
  appName = "Dream App",
): { files: BuildFile[]; replaced: number } {
  if (!hasFullScaffoldTree(archetypeId)) return { files, replaced: 0 };
  const merged = mergeScaffoldForArchetype(archetypeId, files, appName);
  const before = new Map(files.map((f) => [normalizeBuildFilePath(f.path), f.content]));
  let replaced = 0;
  for (const f of merged) {
    const prev = before.get(f.path);
    if (prev && isGeneratedFileStub(prev, f.path) && prev !== f.content) replaced += 1;
  }
  return { files: merged, replaced };
}

function sourceBytes(files: BuildFile[]): number {
  return files.reduce((n, f) => n + (f.content?.length ?? 0), 0);
}

export function gapFillScaffoldForArchetype(
  archetypeId: AppArchetypeId,
  files: BuildFile[],
  appName = "Dream App",
): BuildFile[] {
  /** Production never injects deterministic scaffold — model + continuation only. */
  if (isProductionBuildMode()) return files;

  if (archetypeId === "mental_wellness_journal") {
    return mergeMentalWellnessScaffold(files, appName);
  }
  if (archetypeId === "subscription_box_manager") {
    return mergeSubscriptionBoxScaffold(files, appName);
  }
  if (archetypeId === "restaurant_inventory") {
    return mergeRestaurantInventoryScaffold(files);
  }
  if (archetypeId === "crm") {
    return mergeNonprofitCrmScaffold(files, appName);
  }
  if (FULL_SCAFFOLD_ARCHETYPES.has(archetypeId)) {
    return mergeGenericSaaSScaffoldGapFill(archetypeId, files, appName);
  }
  return files;
}

export function mergeScaffoldForArchetype(
  archetypeId: AppArchetypeId,
  files: BuildFile[],
  appName = "Dream App",
): BuildFile[] {
  if (isProductionBuildMode()) return files;

  if (archetypeId === "mental_wellness_journal") {
    return mergeMentalWellnessScaffold(files, appName);
  }
  if (archetypeId === "subscription_box_manager") {
    return mergeSubscriptionBoxScaffold(files, appName);
  }
  if (archetypeId === "restaurant_inventory") {
    return mergeRestaurantInventoryScaffold(files);
  }
  if (archetypeId === "crm") {
    return mergeNonprofitCrmScaffold(files, appName);
  }
  if (FULL_SCAFFOLD_ARCHETYPES.has(archetypeId)) {
    return mergeGenericSaaSScaffold(archetypeId, files, appName);
  }
  return files;
}

export function isModelOutputSufficient(files: BuildFile[]): boolean {
  const renderable = filterRenderableBuildFiles(files);
  if (renderable.length < MIN_RENDERABLE_FILES) return false;
  if (!rootPageContentOk(renderable)) return false;
  if (!evaluateSourceIntegrity(renderable).sourceIntegrityOk) return false;
  if (countRenderablePages(renderable) < MIN_ROUTE_PAGES) return false;
  return true;
}

export function isWeakBuildOutput(files: BuildFile[], archetypeId: string): boolean {
  const renderable = filterRenderableBuildFiles(files);
  if (renderable.length === 0) return true;
  if (isModelOutputSufficient(renderable)) return false;
  if (!hasFullScaffoldTree(archetypeId)) {
    return renderable.length < STANDARD_MIN_RENDERABLE_FILES;
  }
  if (renderable.length < STANDARD_MIN_RENDERABLE_FILES) return true;
  if (countComponentFiles(renderable) < STANDARD_MIN_COMPONENTS) return true;
  if (countRenderablePages(renderable) < 5) return true;
  return false;
}

/**
 * Apply locked scaffold before contract validation — never allow known archetypes to hit `no_files`.
 */
function emptyFallbackMetrics(
  id: AppArchetypeId,
  files: BuildFile[],
  reason: ScaffoldFallbackReason,
): ScaffoldFallbackResult {
  const before = filterRenderableBuildFiles(files);
  const beforeCount = before.length;
  const integrity = evaluateSourceIntegrity(before);
  return {
    files,
    usedFallback: false,
    reason,
    beforeCount,
    afterCount: beforeCount,
    componentCount: countComponentFiles(before),
    pageCount: countRenderablePages(before),
    archetypeId: id,
    filesAdded: 0,
    filesReplaced: 0,
    stubsReplaced: 0,
    rootPageReplaced: false,
    sourceBytesBefore: sourceBytes(before),
    sourceBytesAfter: sourceBytes(before),
    integrityBefore: integrity.sourceIntegrityOk,
    integrityAfter: integrity.sourceIntegrityOk,
  };
}

export type ScaffoldFallbackOptions = {
  /** When false (production), never install full generic scaffold — gap-fill only. */
  allowFullScaffold?: boolean;
};

export function applyArchetypeScaffoldFallback(
  archetypeId: string,
  files: BuildFile[],
  appName = "Dream App",
  options?: ScaffoldFallbackOptions,
): ScaffoldFallbackResult {
  const allowFullScaffold = options?.allowFullScaffold === true;
  const id = archetypeId as AppArchetypeId;
  const before = filterRenderableBuildFiles(files);
  const beforeCount = before.length;
  const bytesBefore = sourceBytes(before);
  const integrityBefore = evaluateSourceIntegrity(before).sourceIntegrityOk;

  if (!hasFullScaffoldTree(id)) {
    return emptyFallbackMetrics(id, before, "not_needed");
  }

  if (isModelOutputSufficient(before)) {
    return emptyFallbackMetrics(id, before, "not_needed");
  }

  /** Production: block weak-output scaffold replacement, but never leave zero files when we have a tree. */
  const emergencyEmptyScaffold =
    !allowFullScaffold && beforeCount === 0 && hasFullScaffoldTree(id);
  if (!allowFullScaffold && !emergencyEmptyScaffold) {
    const reason: ScaffoldFallbackReason =
      beforeCount === 0 ? "llm_returned_no_files" : "llm_output_too_weak";
    return emptyFallbackMetrics(id, before, reason);
  }

  /** Model-first: rich model output — gap-fill only, never replace with generic scaffold. */
  const modelPages = countRenderablePages(before);
  const modelComponents = countComponentFiles(before);
  if (
    beforeCount >= 12 &&
    modelPages >= 5 &&
    modelComponents >= 8 &&
    integrityBefore &&
    rootPageContentOk(before)
  ) {
    const gapOnly = filterRenderableBuildFiles(gapFillScaffoldForArchetype(id, files, appName));
    const gapAdded = gapOnly.length - beforeCount;
    if (gapAdded <= 3) {
      return emptyFallbackMetrics(id, before, "not_needed");
    }
    return {
      files: gapOnly,
      usedFallback: true,
      reason: "llm_output_too_weak",
      beforeCount,
      afterCount: gapOnly.length,
      componentCount: countComponentFiles(gapOnly),
      pageCount: countRenderablePages(gapOnly),
      archetypeId: id,
      filesAdded: Math.max(0, gapAdded),
      filesReplaced: 0,
      stubsReplaced: 0,
      rootPageReplaced: false,
      sourceBytesBefore: bytesBefore,
      sourceBytesAfter: sourceBytes(gapOnly),
      integrityBefore,
      integrityAfter: evaluateSourceIntegrity(gapOnly).sourceIntegrityOk,
    };
  }

  const weak =
    isWeakBuildOutput(files, id) ||
    !rootPageContentOk(before) ||
    !integrityBefore;

  if (!weak && beforeCount >= STANDARD_MIN_RENDERABLE_FILES && rootPageContentOk(before)) {
    return emptyFallbackMetrics(id, before, "not_needed");
  }

  let reason: ScaffoldFallbackReason = "not_needed";
  if (beforeCount === 0) reason = "llm_returned_no_files";
  else if (!rootPageContentOk(before)) reason = "llm_output_too_weak";
  else if (countComponentFiles(before) < STANDARD_MIN_COMPONENTS) reason = "below_minimum_components";
  else if (countRenderablePages(before) < 5) reason = "below_minimum_routes";
  else if (beforeCount < STANDARD_MIN_RENDERABLE_FILES) reason = "below_minimum_renderable";
  else reason = "llm_output_too_weak";

  const beforePaths = new Set(before.map((f) => normalizeBuildFilePath(f.path)));
  const mergeFn = beforeCount > 0 ? gapFillScaffoldForArchetype : mergeScaffoldForArchetype;
  let merged = filterRenderableBuildFiles(mergeFn(id, files, appName));
  const stubRepair = allowFullScaffold
    ? replaceStubFilesWithArchetypeScaffold(id, merged, appName)
    : { files: merged, replaced: 0 };
  if (stubRepair.replaced > 0) merged = filterRenderableBuildFiles(stubRepair.files);

  const rootBefore = before.find((f) => /^app\/page\.(tsx|jsx)$/i.test(normalizeBuildFilePath(f.path)));
  const rootAfter = merged.find((f) => /^app\/page\.(tsx|jsx)$/i.test(normalizeBuildFilePath(f.path)));
  const rootPageReplaced =
    Boolean(rootAfter) &&
    (!rootBefore ||
      !fileMeetsMeaningfulThreshold(rootBefore) ||
      rootBefore.content !== rootAfter!.content);

  let filesReplaced = 0;
  let filesAdded = 0;
  for (const f of merged) {
    const path = normalizeBuildFilePath(f.path);
    if (!beforePaths.has(path)) filesAdded += 1;
    else {
      const prev = before.find((b) => normalizeBuildFilePath(b.path) === path);
      if (prev && prev.content !== f.content) filesReplaced += 1;
    }
  }

  const bytesAfter = sourceBytes(merged);
  const integrityAfter = evaluateSourceIntegrity(merged).sourceIntegrityOk;
  const improved =
    merged.length > beforeCount ||
    stubRepair.replaced > 0 ||
    filesReplaced > 0 ||
    rootPageReplaced ||
    bytesAfter > bytesBefore + 500 ||
    integrityAfter && !integrityBefore;

  if (!improved) {
    // Scaffold already merged — a second pass cannot add more files but the tree may still be valid.
    if (
      merged.length >= STANDARD_MIN_RENDERABLE_FILES &&
      integrityAfter &&
      rootPageContentOk(merged)
    ) {
      return {
        files: merged,
        usedFallback: beforeCount === 0 || weak,
        reason: beforeCount === 0 ? reason : "not_needed",
        beforeCount,
        afterCount: merged.length,
        componentCount: countComponentFiles(merged),
        pageCount: countRenderablePages(merged),
        archetypeId: id,
        filesAdded,
        filesReplaced,
        stubsReplaced: stubRepair.replaced,
        rootPageReplaced,
        sourceBytesBefore: bytesBefore,
        sourceBytesAfter: bytesAfter,
        integrityBefore,
        integrityAfter,
      };
    }
    if (process.env.NODE_ENV !== "production" || process.env.DREAMOS_STRICT_FALLBACK === "1") {
      throw new Error("fallback_noop_error");
    }
    return emptyFallbackMetrics(id, before, "llm_output_too_weak");
  }

  const result: ScaffoldFallbackResult = {
    files: merged,
    usedFallback: true,
    reason,
    beforeCount,
    afterCount: merged.length,
    componentCount: countComponentFiles(merged),
    pageCount: countRenderablePages(merged),
    archetypeId: id,
    filesAdded,
    filesReplaced,
    stubsReplaced: stubRepair.replaced,
    rootPageReplaced,
    sourceBytesBefore: bytesBefore,
    sourceBytesAfter: bytesAfter,
    integrityBefore,
    integrityAfter,
  };

  console.info("[build] scaffold_fallback_used", {
    archetype: id,
    reason,
    before: beforeCount,
    after: merged.length,
    filesAdded,
    filesReplaced,
    stubsReplaced: stubRepair.replaced,
    rootPageReplaced,
    sourceBytesBefore: bytesBefore,
    sourceBytesAfter: bytesAfter,
    integrityBefore,
    integrityAfter,
  });

  return result;
}

export type BuildFailureRootCause =
  | "llm_returned_no_files"
  | "scaffold_not_applied"
  | "generated_files_dropped_before_contract"
  | "contract_rejected_valid_files"
  | "repair_not_run"
  | "repair_returned_no_files"
  | "persistence_not_reached"
  | "persistence_failed"
  | "files_cleared_after_failure"
  | "wrong_project_id"
  | "rls_hidden_files"
  | "timeout_before_generation_finished"
  | "unknown";

export function classifyBuildFailureRootCause(input: {
  archetypeId: string;
  scaffoldUsed: boolean;
  renderableBeforeFallback: number;
  renderableAfterFallback: number;
  contractPassed: boolean;
  contractFailures: string[];
  persistReached: boolean;
  persistOk: boolean;
  persistedCount: number;
  filesClearedAfterFailure: boolean;
}): BuildFailureRootCause {
  if (input.filesClearedAfterFailure && input.persistedCount === 0 && input.contractPassed) {
    return "files_cleared_after_failure";
  }
  if (!input.contractPassed && input.renderableAfterFallback > 0) {
    if (input.contractFailures.some((f) => f.includes("persisted") || f.includes("db_read"))) {
      return input.persistOk ? "rls_hidden_files" : "persistence_failed";
    }
    return "contract_rejected_valid_files";
  }
  if (!input.scaffoldUsed && input.renderableBeforeFallback === 0) {
    return hasFullScaffoldTree(input.archetypeId) ? "scaffold_not_applied" : "llm_returned_no_files";
  }
  if (!input.persistReached && input.contractPassed) return "persistence_not_reached";
  if (input.persistReached && !input.persistOk) return "persistence_failed";
  if (!input.contractPassed && input.renderableAfterFallback === 0) {
    return input.scaffoldUsed ? "generated_files_dropped_before_contract" : "llm_returned_no_files";
  }
  return "unknown";
}
