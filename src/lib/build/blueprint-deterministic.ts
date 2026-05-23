import { classifyBuildIntent } from "@/lib/ai/build-intent-classifier";
import { planGenerationBudget } from "@/lib/ai/generation-budget-planner";
import type { AppBlueprint, BlueprintQualityLevel } from "@/lib/build/blueprint-schema";
import { PREMIUM_BUILD_STAGES } from "@/lib/build/premium-stage-labels";
import {
  applyBlueprintArchetype,
  detectArchetype,
} from "@/lib/build/blueprint-archetypes";
import { buildBackendPlan } from "@/lib/build/backend-plan";
import { buildDatabaseDepthPlan } from "@/lib/build/database-depth-plan";
import {
  blueprintFromTemplate,
  getCoreTemplate,
  resolveTemplateId,
} from "@/lib/templates/template-archetypes";
import { getTemplateById } from "@/lib/templates/template-catalog";
import { getStylePresetById } from "@/lib/create/style-presets";

export type DeterministicBlueprintInput = {
  prompt: string;
  templateId?: string | null;
  stylePresetId?: string | null;
  modelId?: string;
  qualityLevel?: BlueprintQualityLevel;
};

export function buildDeterministicBlueprint(input: DeterministicBlueprintInput): AppBlueprint {
  const intent = classifyBuildIntent(input.prompt);
  const resolvedTemplate = resolveTemplateId(input.templateId ?? null);
  const catalogTemplate = input.templateId ? getTemplateById(input.templateId) : undefined;
  const coreTemplate = resolvedTemplate ? getCoreTemplate(resolvedTemplate) : undefined;
  const style = getStylePresetById(input.stylePresetId);
  const quality = input.qualityLevel ?? "standard";

  const archetypeKey = detectArchetype(input.prompt, resolvedTemplate ?? input.templateId ?? undefined);
  const archetypePartial = applyBlueprintArchetype(archetypeKey, input.prompt);
  const templatePartial = resolvedTemplate
    ? blueprintFromTemplate(resolvedTemplate, input.prompt)
    : {};

  const plan = planGenerationBudget({
    prompt: input.prompt,
    mode: "full_build",
    selectedModel: input.modelId ?? "gemini-flash",
    fileCount: coreTemplate?.defaultRoutes.length ?? catalogTemplate?.pages.length ?? 10,
  });

  const appName =
    (catalogTemplate?.name ?? coreTemplate?.name ?? archetypePartial.appName ?? input.prompt.split(/[.!?\n]/)[0]?.trim()).slice(0, 48) ||
    "Dream App";

  const appTypeLabel = templatePartial.appType ?? archetypePartial.appType ?? "SaaS product";
  const targetUsers =
    archetypePartial.targetUsers ??
    (coreTemplate ? `${coreTemplate.name} users — ${coreTemplate.description}` : null) ??
    `Operators and customers using ${appName}`;
  const primaryUserJobs =
    templatePartial.primaryUserJobs ??
    archetypePartial.primaryUserJobs ??
    (intent.reason ? [intent.reason.slice(0, 100)] : [`Use ${appName} to accomplish their goal`]);

  const merged: AppBlueprint = {
    appName,
    appType: appTypeLabel,
    category: coreTemplate?.category ?? catalogTemplate?.category,
    oneSentencePitch: archetypePartial.oneSentencePitch ?? input.prompt.slice(0, 200),
    targetUsers,
    primaryUserJobs,
    pages: templatePartial.pages ?? archetypePartial.pages ?? [{ route: "/", purpose: "Home" }],
    routeMap: templatePartial.routeMap ?? archetypePartial.routeMap ?? templatePartial.pages ?? [],
    componentMap: templatePartial.componentMap ?? archetypePartial.componentMap ?? ["App shell", "Navigation"],
    dataModel: templatePartial.dataModel?.length
      ? templatePartial.dataModel
      : archetypePartial.dataModel ?? [],
    authModel: archetypePartial.authModel ?? "Optional — public-first unless auth requested",
    permissionsModel: archetypePartial.permissionsModel,
    adminModel: archetypePartial.adminModel ?? "None unless /admin in routes",
    integrations: catalogTemplate?.requiredIntegrations ?? archetypePartial.integrations ?? [],
    requiredEnvVars: [
      { key: "NEXT_PUBLIC_SUPABASE_URL", public: true, example: "https://your-project.supabase.co" },
      { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", public: true },
    ],
    designSystem: style?.designSystem ?? catalogTemplate?.description ?? "Clean, modern, production-ready UI",
    designDirection: style?.designDirection,
    styleInfluence: style ? `${style.label}: ${style.designDirection}` : undefined,
    templateInfluence: coreTemplate ? `${coreTemplate.name} — ${coreTemplate.description}` : undefined,
    responsiveStrategy: templatePartial.mobileStrategy ?? archetypePartial.mobileStrategy ?? "Mobile-first",
    mobileStrategy: templatePartial.mobileStrategy ?? archetypePartial.mobileStrategy,
    emptyStates: templatePartial.emptyStates ?? archetypePartial.emptyStates ?? ["No data yet"],
    loadingStates: templatePartial.loadingStates ?? archetypePartial.loadingStates ?? ["Skeleton loaders"],
    errorStates: templatePartial.errorStates ?? archetypePartial.errorStates ?? ["Inline errors"],
    uiRequirements: templatePartial.uiRequirements ?? archetypePartial.uiRequirements ?? [],
    apiActionsPlan: archetypePartial.apiActionsPlan ?? templatePartial.primaryUserJobs ?? [],
    backendRequirements: [
      ...(templatePartial.backendRequirements ?? []),
      ...(archetypePartial.backendRequirements ?? []),
    ],
    previewAssumptions: archetypePartial.previewAssumptions ?? ["Preview uses mock data"],
    publishAssumptions: archetypePartial.publishAssumptions ?? ["Path-mode /p/slug when ready"],
    monetizationAssumptions: /\b(stripe|payment|subscription)\b/i.test(input.prompt)
      ? ["Stripe checkout when keys configured"]
      : [],
    deploymentAssumptions: ["Preview on DreamOS86 first", "Connect Vercel optionally"],
    estimatedComplexity: coreTemplate?.complexity === "advanced" ? 8 : plan.complexity,
    estimatedUserCredits: plan.creditQuote.userCreditsRequired,
    costSavingStrategy: "Staged build; blueprint cached; cheap model for plan",
    qualityLevel: quality,
    sourceMode: resolvedTemplate ? "template_assisted" : "deterministic_quick",
    templateId: resolvedTemplate ?? input.templateId ?? null,
    risks: [
      ...(archetypePartial.risks ?? []),
      ...(intent.confidence < 0.6 ? ["Prompt may need clarification before build"] : []),
    ],
    exclusions: archetypePartial.exclusions ?? ["Native mobile binaries", "Fake deploy claims"],
    acceptanceCriteria: [
      ...new Set([
        ...(templatePartial.acceptanceCriteria ?? []),
        ...(archetypePartial.acceptanceCriteria ?? []),
        "All routes in routeMap render without placeholder labels",
        "Mobile layout verified at 390px width",
        "Loading, empty, and error states implemented",
        "Preview uses honest mock data until backend is connected",
      ]),
    ].slice(0, 10),
    qualityChecklist: [
      ...new Set([
        ...(archetypePartial.qualityChecklist ?? []),
        ...(templatePartial.qualityChecklist ?? []),
        "No Sample Item labels",
        "Distinct screen purposes per route",
      ]),
    ],
    buildStages: PREMIUM_BUILD_STAGES.map((s) => s.label),
    buildConfidence: Math.round(intent.confidence * 100),
    authRequired: /\b(auth|login|sign up|user account)\b/i.test(input.prompt),
    adminRequired: /\badmin\b/i.test(input.prompt) || (archetypePartial.pages ?? []).some((p) => p.route.includes("admin")),
  };

  const backend = buildBackendPlan(merged);
  const dbPlan = buildDatabaseDepthPlan(merged);
  if (backend.requiresBackend && merged.backendRequirements.length === 0) {
    merged.backendRequirements = backend.rlsExpectations;
  }
  merged.risks = [...(merged.risks ?? []), ...backend.honestLimitations.slice(0, 1)];
  if (dbPlan.indexes.length) {
    merged.backendRequirements = [...merged.backendRequirements, ...dbPlan.indexes.map((i) => `Index: ${i}`)];
  }

  // Prompt-specific enrichment for benchmark and create flows
  merged.oneSentencePitch = input.prompt.slice(0, 220);
  if (/\bsupport|ticket|sla\b/i.test(input.prompt) && !(merged.routeMap ?? []).some((r) => /ticket/i.test(r.route))) {
    merged.pages = [...(merged.pages ?? []), { route: "/tickets", purpose: "Support ticket queue with SLA" }];
    merged.routeMap = [...(merged.routeMap ?? []), { route: "/tickets", purpose: "Ticket inbox" }];
  }
  if (/\binventory|stock|supplier\b/i.test(input.prompt)) {
    merged.pages = [...(merged.pages ?? []), { route: "/inventory", purpose: "Stock levels and suppliers" }];
    merged.routeMap = [...(merged.routeMap ?? []), { route: "/inventory", purpose: "Inventory alerts" }];
    if (!(merged.dataModel ?? []).some((t) => t.name === "inventory_items")) {
      merged.dataModel = [
        ...(merged.dataModel ?? []),
        { name: "inventory_items", columns: ["id", "sku", "qty", "reorder_at"] },
      ];
    }
  }

  return merged;
}
