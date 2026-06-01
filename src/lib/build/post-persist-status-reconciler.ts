/**
 * Final status after files are on disk — requires real source integrity, not path counts alone.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { validateGeneratedApp } from "@/lib/build/generated-app-validator";
import { filterRenderableBuildFiles, type BuildFile } from "@/lib/build/generated-file-utils";
import { MIN_RENDERABLE_FILES } from "@/lib/build/build-success-contract";
import {
  parseMissingBlueprintRoutes,
  repairMissingBlueprintRoutes,
} from "@/lib/build/blueprint-route-repair";
import { normalizeAppRouterBuildFiles } from "@/lib/build/app-router-route-normalizer";
import { tracePersistGeneratedFiles } from "@/lib/build/files-persist-trace";
import {
  evaluateSourceIntegrity,
  isPortfolioBuildPrompt,
  type SourceIntegrityReport,
} from "@/lib/build/source-integrity-validator";
import { mergePortfolioScaffold } from "@/lib/build/portfolio-scaffold";
import { repairRootPageContent, rootPageContentOk } from "@/lib/build/root-page-repair";
import type { AppArchetypeId } from "@/lib/build/app-archetype-classifier";

export type PostPersistReconcileInput = {
  writer: SupabaseClient<Database>;
  projectId: string;
  ownerId: string;
  appName?: string;
  blueprintRoutes?: string[] | null;
  priorFailures?: string[];
  operationId?: string;
  executionInstanceId?: string;
  userPrompt?: string;
  previewSessionOk?: boolean;
  previewHtmlLength?: number;
  previewHtmlSnippet?: string;
  archetypeId?: string;
};

export type PostPersistReconcileResult = {
  persistedFileCount: number;
  visibleFileCount: number;
  renderableCount: number;
  readableContentCount: number;
  hasRootPage: boolean;
  hasPackageJson: boolean;
  previewCanRender: boolean;
  technicalPreviewError: string | null;
  unresolvedBlueprintRoutes: string[];
  uiQualityOnlyFailures: boolean;
  technicalOnlyFailures: boolean;
  shouldComplete: boolean;
  shouldTechnicalRepair: boolean;
  persistenceFailure: boolean;
  technicalGenerationIncomplete: boolean;
  repairedBlueprintRoutes: string[];
  sourceIntegrity: SourceIntegrityReport;
  files: BuildFile[];
};

function isUiQualityOnlyFailure(failures: string[]): boolean {
  if (failures.length === 0) return false;
  return failures.every(
    (f) =>
      f.startsWith("ui_quality_") ||
      f === "ui_too_basic" ||
      f.startsWith("route_pages_") ||
      f.startsWith("components_"),
  );
}

export async function reconcilePostPersistBuildStatus(
  input: PostPersistReconcileInput,
): Promise<PostPersistReconcileResult> {
  const { data: rows } = await input.writer
    .from("app_files")
    .select("path, content")
    .eq("project_id", input.projectId)
    .limit(250);

  let files: BuildFile[] = filterRenderableBuildFiles(
    (rows ?? []).map((r) => ({ path: r.path!, content: r.content ?? "" })),
  );

  let sourceIntegrity = evaluateSourceIntegrity(files, {
    previewSessionOk: input.previewSessionOk,
    previewHtmlLength: input.previewHtmlLength,
    previewHtmlSnippet: input.previewHtmlSnippet,
  });

  const blueprintRoutes =
    input.blueprintRoutes ??
    parseMissingBlueprintRoutes(input.priorFailures ?? []);

  let repairedBlueprintRoutes: string[] = [];
  if (blueprintRoutes.length > 0 && sourceIntegrity.meaningfulSourceFileCount < 8) {
    const repaired = repairMissingBlueprintRoutes(
      files,
      blueprintRoutes,
      input.appName ?? "Your app",
    );
    if (repaired.addedRoutes.length > 0) {
      repairedBlueprintRoutes = repaired.addedRoutes;
      const norm = normalizeAppRouterBuildFiles(repaired.files, {
        blueprintRoutes,
        appName: input.appName,
      });
      files = filterRenderableBuildFiles(norm.files);
    }
  }

  const appName = input.appName ?? "Your app";
  const needsRootRepair =
    !rootPageContentOk(files) ||
    sourceIntegrity.blockedReason?.includes("missing_root_page") ||
    !sourceIntegrity.sourceIntegrityOk;

  if (needsRootRepair) {
    if (isPortfolioBuildPrompt(input.userPrompt ?? "")) {
      files = filterRenderableBuildFiles(mergePortfolioScaffold(files, appName));
    } else {
      let repaired = repairRootPageContent(
        (input.archetypeId ?? "dashboard") as AppArchetypeId,
        files,
        appName,
      );
      files = filterRenderableBuildFiles(repaired.files);
      if (!rootPageContentOk(files)) {
        repaired = repairRootPageContent("generic_app", files, appName);
        files = filterRenderableBuildFiles(repaired.files);
      }
    }
    sourceIntegrity = evaluateSourceIntegrity(files, {
      previewSessionOk: input.previewSessionOk,
      previewHtmlLength: input.previewHtmlLength,
      previewHtmlSnippet: input.previewHtmlSnippet,
    });

    if (input.operationId && files.length > 0) {
      await tracePersistGeneratedFiles({
        writer: input.writer,
        projectId: input.projectId,
        ownerId: input.ownerId,
        files,
        operationId: input.operationId,
        executionInstanceId: input.executionInstanceId,
      }).catch(() => undefined);
    }
  }

  const renderableCount = files.length;
  const hasRootPage = files.some((f) => /^app\/page\.(tsx|jsx|js)$/i.test(f.path));
  const hasPackageJson = files.some((f) => f.path === "package.json");
  const readableContentCount = sourceIntegrity.codeTabReadableCount;

  const validation = validateGeneratedApp({
    files,
    projectId: input.projectId,
    ownerId: input.ownerId,
    routeMap: blueprintRoutes.length ? blueprintRoutes : null,
  });

  const failures = [...new Set([...(input.priorFailures ?? []), ...validation.reasons])].filter(
    (f) => !f.startsWith("missing_blueprint_routes") || repairedBlueprintRoutes.length === 0,
  );

  const unresolvedBlueprintRoutes = parseMissingBlueprintRoutes(failures);
  const uiQualityOnlyFailures = isUiQualityOnlyFailure(failures);
  const technicalOnlyFailures =
    failures.length > 0 &&
    failures.some(
      (f) =>
        f.startsWith("missing_import") ||
        f === "no_page_route" ||
        f.startsWith("placeholder_") ||
        f === "todo_only_content",
    ) &&
    !uiQualityOnlyFailures;

  const visibleFileCount = rows?.length ?? renderableCount;
  const persistedFileCount = visibleFileCount;

  const persistenceFailure =
    visibleFileCount > 0 && sourceIntegrity.meaningfulSourceFileCount === 0;

  const technicalGenerationIncomplete =
    !sourceIntegrity.sourceIntegrityOk && visibleFileCount > 0;

  const previewCanRender = sourceIntegrity.previewRenderable;

  const shouldComplete =
    !persistenceFailure &&
    !technicalGenerationIncomplete &&
    sourceIntegrity.sourceIntegrityOk &&
    previewCanRender;

  const shouldTechnicalRepair =
    !shouldComplete &&
    !persistenceFailure &&
    (technicalGenerationIncomplete ||
      technicalOnlyFailures ||
      unresolvedBlueprintRoutes.length > 0 ||
      !previewCanRender);

  return {
    persistedFileCount,
    visibleFileCount,
    renderableCount,
    readableContentCount,
    hasRootPage,
    hasPackageJson,
    previewCanRender,
    technicalPreviewError: shouldComplete
      ? null
      : sourceIntegrity.blockedReason ??
        failures.find((f) => f.startsWith("missing_")) ??
        validation.reasons[0] ??
        null,
    unresolvedBlueprintRoutes,
    uiQualityOnlyFailures,
    technicalOnlyFailures,
    shouldComplete,
    shouldTechnicalRepair,
    persistenceFailure,
    technicalGenerationIncomplete,
    repairedBlueprintRoutes,
    sourceIntegrity,
    files,
  };
}
