import type { AppBlueprint } from "@/lib/build/blueprint-schema";

export type BlueprintScoreBreakdown = {
  total: number;
  appSpecificRelevance: number;
  routeCompleteness: number;
  backendCompleteness: number;
  uiRequirementCompleteness: number;
  mobileStrategy: number;
  riskExclusionClarity: number;
  acceptanceCriteriaQuality: number;
  templateStyleConsistency: number;
};

function clamp(n: number, max = 100): number {
  return Math.max(0, Math.min(max, Math.round(n)));
}

export function scoreBlueprint(blueprint: AppBlueprint): BlueprintScoreBreakdown {
  const routes = blueprint.routeMap?.length ?? 0;
  const pages = blueprint.pages?.length ?? 0;
  const tables = blueprint.dataModel?.length ?? 0;
  const jobs = blueprint.primaryUserJobs?.length ?? 0;
  const uiReq = (blueprint as { uiRequirements?: string[] }).uiRequirements?.length ?? 0;
  const backendReq = (blueprint as { backendRequirements?: string[] }).backendRequirements?.length ?? 0;
  const exclusions = blueprint.exclusions?.length ?? 0;
  const risks = blueprint.risks?.length ?? 0;
  const acceptance = blueprint.acceptanceCriteria?.length ?? 0;
  const hasMobile = Boolean(blueprint.responsiveStrategy || (blueprint as { mobileStrategy?: string }).mobileStrategy);
  const templateOk = blueprint.templateId ? 85 : 70;
  const styleOk = blueprint.designDirection || blueprint.designSystem ? 80 : 65;

  const genericText = [
    blueprint.targetUsers ?? "",
    ...(blueprint.primaryUserJobs ?? []),
    blueprint.oneSentencePitch ?? "",
  ].join(" ");
  const genericPenalty =
    /users described in your prompt|complete the core workflow|complete core workflow/i.test(genericText)
      ? 15
      : 0;

  const templateBonus = blueprint.templateInfluence ? 12 : 0;
  const styleBonus = blueprint.styleInfluence || blueprint.designDirection ? 8 : 0;
  const appSpecificRelevance = clamp(
    jobs * 18 + (blueprint.oneSentencePitch?.length > 40 ? 22 : 12) - genericPenalty + templateBonus + styleBonus,
  );
  const routeCompleteness = clamp(
    Math.min(100, routes * 14 + pages * 5 + (routes >= 4 ? 18 : routes >= 3 ? 12 : 0)),
  );
  const backendCompleteness = clamp(
    tables * 14 + backendReq * 8 + (blueprint.authModel ? 12 : 0) + (tables >= 2 ? 10 : 0),
  );
  const uiRequirementCompleteness = clamp(
    (blueprint.componentMap?.length ?? 0) * 8 + uiReq * 10 + (blueprint.emptyStates?.length ? 10 : 0),
  );
  const mobileStrategy = hasMobile ? 85 : 40;
  const riskExclusionClarity = clamp(exclusions * 12 + risks * 10 + 20);
  const acceptanceCriteriaQuality = clamp(acceptance * 12 + 20);
  const templateStyleConsistency = clamp((templateOk + styleOk) / 2);

  const total = clamp(
    appSpecificRelevance * 0.18 +
      routeCompleteness * 0.16 +
      backendCompleteness * 0.14 +
      uiRequirementCompleteness * 0.14 +
      mobileStrategy * 0.1 +
      riskExclusionClarity * 0.1 +
      acceptanceCriteriaQuality * 0.1 +
      templateStyleConsistency * 0.08,
  );

  return {
    total,
    appSpecificRelevance,
    routeCompleteness,
    backendCompleteness,
    uiRequirementCompleteness,
    mobileStrategy,
    riskExclusionClarity,
    acceptanceCriteriaQuality,
    templateStyleConsistency,
  };
}
