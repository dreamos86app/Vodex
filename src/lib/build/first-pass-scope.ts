/**
 * Build scope — full-app generation minimums (P1.3.14).
 */
import type { BuildIntakeSummary } from "@/lib/ai/build-intake-types";
import { resolveFullAppGenerationPlan } from "@/lib/build/full-app-generation-plan";

export type FirstPassTier = "simple" | "standard" | "advanced";

export type FirstPassScope = {
  tier: FirstPassTier;
  complexity: number;
  maxFiles: number;
  maxWorkUnits: number;
  includeBackend: boolean;
  includeAuth: boolean;
  includePayments: boolean;
  includeIntegrations: boolean;
  mustHaveFeatures: string[];
  deferredFeatures: string[];
  scopeNote: string;
  firstPassTaskCount: number;
  backlogTaskCount: number;
};

/** First-pass task caps by tier — everything else goes to backlog. */
export const FIRST_PASS_TASK_CAPS: Record<FirstPassTier, { min: number; max: number }> = {
  simple: { min: 5, max: 8 },
  standard: { min: 8, max: 12 },
  advanced: { min: 12, max: 15 },
};

const DEFER_SIGNALS =
  /\b(auth|login|signup|oauth|payment|stripe|checkout|billing|subscription|admin|role|permission|webhook|integration|api key|realtime|websocket|analytics|deployment|ci\/cd|multi-tenant|sso)\b/i;

const PRIORITY_SIGNALS =
  /\b(dashboard|home|landing|shell|navigation|layout|screen|page|view|ui|preview|demo|list|table|card|form|flow|workflow|hero|cta)\b/i;

function tierFromIntake(intake: BuildIntakeSummary): FirstPassTier {
  const systems =
    (intake.complexBackendRequirements?.length ?? 0) +
    (intake.mustHaveFirstVersionFeatures?.filter((f) => DEFER_SIGNALS.test(f)).length ?? 0);
  const screens = intake.coreScreens?.length ?? 0;
  if (systems >= 4 || screens > 8) return "advanced";
  if (systems >= 2 || screens > 5) return "standard";
  return "simple";
}

function rankTaskValue(task: string): number {
  let score = 0;
  if (PRIORITY_SIGNALS.test(task)) score += 6;
  if (DEFER_SIGNALS.test(task)) score -= 8;
  if (task.length > 120) score -= 2;
  return score;
}

export function rankTasksByFirstPassValue(tasks: string[]): string[] {
  return [...tasks].sort((a, b) => rankTaskValue(b) - rankTaskValue(a));
}

function taskCapTier(tier: string): keyof typeof FIRST_PASS_TASK_CAPS {
  if (tier === "medium" || tier === "complex" || tier === "advanced") return "advanced";
  if (tier === "standard") return "standard";
  return "simple";
}

export function selectFirstPassTasks(
  tasks: string[],
  tier: FirstPassTier,
): { selected: string[]; deferred: string[] } {
  const cap = FIRST_PASS_TASK_CAPS[taskCapTier(tier)];
  const ranked = rankTasksByFirstPassValue(tasks);
  const selected = ranked.slice(0, cap.max);
  const deferred = ranked.slice(cap.max);
  return { selected, deferred };
}

export function planFirstPassScope(intake: BuildIntakeSummary): FirstPassScope {
  const tier = tierFromIntake(intake);
  const mustHave = intake.mustHaveFirstVersionFeatures ?? [];
  const niceToHave = intake.niceToHaveLaterFeatures ?? [];
  const integrations = intake.complexBackendRequirements ?? [];

  const allTasks = rankTasksByFirstPassValue([
    ...mustHave.filter((f) => !DEFER_SIGNALS.test(f)),
    ...intake.coreScreens.map((s) => `Screen: ${s}`),
  ]);

  const deferredFromMust = mustHave.filter((f) => DEFER_SIGNALS.test(f));
  const { selected: firstPassMust, deferred: overflowTasks } = selectFirstPassTasks(allTasks, tier);

  const deferredFeatures = [
    ...deferredFromMust,
    ...overflowTasks,
    ...niceToHave,
    ...integrations.filter((i) => DEFER_SIGNALS.test(i)),
  ].slice(0, 80);

  const promptText = [
    intake.appPurpose ?? "",
    ...(intake.coreScreens ?? []),
    ...(intake.mustHaveFirstVersionFeatures ?? []),
  ]
    .filter(Boolean)
    .join(" ");
  const genPlan = resolveFullAppGenerationPlan({
    prompt: promptText,
    intake,
    complexity: tier === "advanced" ? 8 : tier === "standard" ? 6 : 4,
  });
  const complexity = genPlan.complexity;

  const includeBackend =
    genPlan.tier !== "simple" &&
    integrations.some((i) => /\b(database|schema|api|backend)\b/i.test(i));

  return {
    tier: taskCapTier(genPlan.tier),
    complexity,
    maxFiles: genPlan.maxFiles,
    maxWorkUnits: genPlan.tier === "complex" ? 14 : genPlan.tier === "medium" ? 12 : 10,
    includeBackend,
    includeAuth: false,
    includePayments: false,
    includeIntegrations: false,
    mustHaveFeatures: firstPassMust,
    deferredFeatures,
    firstPassTaskCount: firstPassMust.length,
    backlogTaskCount: deferredFeatures.length,
    scopeNote: [
      `Full app generation (${genPlan.tier}): minimum ${genPlan.minFiles} files, ${genPlan.minRoutes} routes, ${genPlan.minComponents} components.`,
      "Model generates all UI — scaffolds are emergency gap-fill only.",
      "Include app shell, navigation, feature routes, mock data, loading/empty/error states.",
      firstPassMust.length
        ? `Priority features (${firstPassMust.length}): ${firstPassMust.slice(0, 8).join("; ")}`
        : "",
      deferredFeatures.length
        ? `Phase 2 (${deferredFeatures.length}): ${deferredFeatures.slice(0, 6).join("; ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

export function firstPassTierCredits(tier: FirstPassTier): { min: number; max: number } {
  switch (tier) {
    case "simple":
      return { min: 4, max: 6 };
    case "standard":
      return { min: 6, max: 9 };
    case "advanced":
      return { min: 9, max: 14 };
    default:
      return { min: 6, max: 9 };
  }
}
