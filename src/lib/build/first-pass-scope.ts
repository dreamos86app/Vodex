/**
 * First-pass build scope — preview-ready UI and core flows only.
 */
import type { BuildIntakeSummary } from "@/lib/ai/build-intake-types";

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

export function selectFirstPassTasks(
  tasks: string[],
  tier: FirstPassTier,
): { selected: string[]; deferred: string[] } {
  const cap = FIRST_PASS_TASK_CAPS[tier];
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

  const complexity = tier === "advanced" ? 7 : tier === "standard" ? 5 : 3;

  const includeBackend =
    tier === "advanced" &&
    integrations.some((i) => /\b(database|schema|api|backend)\b/i.test(i)) &&
    firstPassMust.length <= FIRST_PASS_TASK_CAPS.advanced.max;

  return {
    tier,
    complexity,
    maxFiles: tier === "advanced" ? 14 : tier === "standard" ? 12 : 10,
    maxWorkUnits: tier === "advanced" ? 10 : 8,
    includeBackend,
    includeAuth: false,
    includePayments: false,
    includeIntegrations: false,
    mustHaveFeatures: firstPassMust,
    deferredFeatures,
    firstPassTaskCount: firstPassMust.length,
    backlogTaskCount: deferredFeatures.length,
    scopeNote: [
      "First pass: beautiful UI preview, app shell, core screens, main user flow, demo-safe data.",
      "Defer full backend, payments, auth matrix, admin systems, and external API wiring unless essential for preview.",
      firstPassMust.length
        ? `Build now (${firstPassMust.length} items): ${firstPassMust.slice(0, 8).join("; ")}`
        : "",
      deferredFeatures.length
        ? `Queued next (${deferredFeatures.length} items): ${deferredFeatures.slice(0, 6).join("; ")}`
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
  }
}
