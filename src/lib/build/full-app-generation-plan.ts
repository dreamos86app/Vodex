/**
 * P1.3.14 — Full-app generation budgets by complexity tier.
 * Replaces thin first-pass caps with minimum meaningful app sizes.
 */
import type { BuildIntakeSummary } from "@/lib/ai/build-intake-types";

export type AppGenerationTier = "simple" | "medium" | "complex";

export type FullAppGenerationBudget = {
  tier: AppGenerationTier;
  complexity: number;
  minFiles: number;
  minRoutes: number;
  minComponents: number;
  maxFiles: number;
  minQualityScore: number;
  maxContinuationPasses: number;
};

export const GENERATION_TIER_BUDGETS: Record<
  AppGenerationTier,
  Omit<FullAppGenerationBudget, "tier" | "complexity">
> = {
  simple: {
    minFiles: 25,
    minRoutes: 6,
    minComponents: 10,
    maxFiles: 38,
    minQualityScore: 78,
    maxContinuationPasses: 3,
  },
  medium: {
    minFiles: 40,
    minRoutes: 8,
    minComponents: 18,
    maxFiles: 58,
    minQualityScore: 84,
    maxContinuationPasses: 4,
  },
  complex: {
    minFiles: 65,
    minRoutes: 12,
    minComponents: 30,
    maxFiles: 82,
    minQualityScore: 88,
    maxContinuationPasses: 5,
  },
};

function tierFromComplexity(complexity: number): AppGenerationTier {
  if (complexity >= 8) return "complex";
  if (complexity >= 5) return "medium";
  return "simple";
}

function tierFromIntake(intake?: BuildIntakeSummary | null): AppGenerationTier {
  if (!intake) return "medium";
  const screens = intake.coreScreens?.length ?? 0;
  const features = intake.mustHaveFirstVersionFeatures?.length ?? 0;
  const systems = intake.complexBackendRequirements?.length ?? 0;
  if (screens >= 9 || features >= 10 || systems >= 4) return "complex";
  if (screens >= 5 || features >= 6 || systems >= 2) return "medium";
  return "simple";
}

export function resolveFullAppGenerationPlan(input: {
  prompt: string;
  complexity?: number;
  intake?: BuildIntakeSummary | null;
}): FullAppGenerationBudget {
  const prompt = input.prompt.trim();
  const featureSignals =
    (prompt.match(/\b(page|screen|route|dashboard|calendar|booking|payment|member|class|inventory|crm|chart|table|form)\b/gi) ?? [])
      .length;
  let complexity = input.complexity ?? 5;
  if (prompt.length > 900) complexity += 1;
  if (featureSignals >= 8) complexity += 2;
  else if (featureSignals >= 4) complexity += 1;
  complexity = Math.min(10, Math.max(3, complexity));

  const intakeTier = tierFromIntake(input.intake);
  const complexityTier = tierFromComplexity(complexity);
  const tierRank = { simple: 0, medium: 1, complex: 2 };
  const tier =
    tierRank[intakeTier] >= tierRank[complexityTier] ? intakeTier : complexityTier;
  const budget = GENERATION_TIER_BUDGETS[tier];

  return {
    tier,
    complexity,
    ...budget,
  };
}

export function formatGenerationBudgetForPrompt(plan: FullAppGenerationBudget): string {
  return [
    `FULL APP GENERATION BUDGET (${plan.tier}, complexity ${plan.complexity}/10):`,
    `- Minimum ${plan.minFiles} meaningful source files (not stubs).`,
    `- Minimum ${plan.minRoutes} routes under app/ with real UI.`,
    `- Minimum ${plan.minComponents} reusable components under components/.`,
    `- App shell: layout + sidebar/top nav + mobile nav.`,
    `- Each route: realistic mock data, loading/empty/error states.`,
    `- Domain-specific copy — never generic "metrics, workflows, team tools".`,
    `- Quality gate: score must reach ${plan.minQualityScore}/100 before complete.`,
  ].join("\n");
}
