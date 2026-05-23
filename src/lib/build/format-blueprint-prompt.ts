import type { AppBlueprint } from "@/lib/build/blueprint-schema";
import { sanitizeBlueprintForUser } from "@/lib/build/blueprint-schema";
import { buildBackendPlan } from "@/lib/build/backend-plan";
import { buildFullUiGenerationBlock, type UiGenerationContext } from "@/lib/generation/ui-quality-spec";
import { stylePresetDesignFragment } from "@/lib/create/style-presets";

/** Approved blueprint block for build pipeline prompts (user-safe fields only). */
export function formatBlueprintForBuild(
  blueprint: AppBlueprint,
  uiCtx?: Partial<UiGenerationContext>,
): string {
  const safe = sanitizeBlueprintForUser(blueprint);
  const backend = buildBackendPlan(safe);
  const stylePresetId = uiCtx?.stylePresetId ?? null;
  const ctx: UiGenerationContext = {
    stylePresetId,
    templateId: uiCtx?.templateId ?? safe.templateId ?? undefined,
    buildTier: uiCtx?.buildTier,
    appType: safe.appType,
    targetUsers: safe.targetUsers,
    designSystem:
      safe.designSystem && typeof safe.designSystem === "object"
        ? (safe.designSystem as Record<string, unknown>)
        : null,
    routeMap: safe.routeMap?.map((r) => (typeof r === "string" ? r : r.route)),
    componentMap: safe.componentMap ?? safe.pages?.map((p) => p.route),
  };

  const styleFragment = stylePresetDesignFragment(stylePresetId);

  return [
    "APPROVED APP BLUEPRINT (source of truth — follow this over raw user prompt when they conflict):",
    JSON.stringify(
      {
        appName: safe.appName,
        appType: safe.appType,
        category: safe.category,
        pitch: safe.oneSentencePitch,
        targetUsers: safe.targetUsers,
        primaryUserJobs: safe.primaryUserJobs,
        pages: safe.pages,
        routeMap: safe.routeMap,
        componentMap: safe.componentMap,
        dataModel: safe.dataModel,
        authModel: safe.authModel,
        permissionsModel: safe.permissionsModel,
        adminModel: safe.adminModel,
        integrations: safe.integrations,
        apiActionsPlan: safe.apiActionsPlan,
        backendRequirements: safe.backendRequirements,
        uiRequirements: safe.uiRequirements,
        emptyStates: safe.emptyStates,
        loadingStates: safe.loadingStates,
        errorStates: safe.errorStates,
        mobileStrategy: safe.mobileStrategy ?? safe.responsiveStrategy,
        templateInfluence: safe.templateInfluence,
        styleInfluence: safe.styleInfluence,
        designSystem: safe.designSystem,
        designDirection: safe.designDirection,
        stylePresetId,
        templateId: safe.templateId,
        buildStages: safe.buildStages,
        acceptanceCriteria: safe.acceptanceCriteria,
        exclusions: safe.exclusions,
        risks: safe.risks,
        qualityChecklist: safe.qualityChecklist,
        previewAssumptions: safe.previewAssumptions,
        publishAssumptions: safe.publishAssumptions,
        estimatedUserCredits: safe.estimatedUserCredits,
        backendPlanHonest: backend.honestLimitations,
      },
      null,
      0,
    ).slice(0, 8000),
    styleFragment ? `\nSTYLE PRESET (blueprint): ${styleFragment}` : "",
    backend.requiresBackend
      ? `\nBACKEND PLAN (preview-safe): ${backend.previewMockStrategy}. User config: ${backend.userConfigurationChecklist.join("; ")}`
      : "",
    "",
    buildFullUiGenerationBlock(ctx),
  ].join("\n");
}
