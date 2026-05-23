/**
 * Structured template metadata for generation planning and UI.
 */
import { templates, type Template } from "@/lib/data";
import { quoteGenerationCost } from "@/lib/billing/credit-profit-guard";
import {
  CORE_TEMPLATES,
  getCoreTemplate,
  resolveTemplateId,
  type CoreTemplateId,
} from "@/lib/templates/template-archetypes";
import { getTemplateFilePlan } from "@/lib/templates/template-file-plans";
import { getTemplateUiPatterns } from "@/lib/templates/template-ui-patterns";

export type TemplateBlueprint = Template & {
  estimatedCredits: number;
  pages: string[];
  features: string[];
  requiredIntegrations: string[];
  starterBlueprint?: string;
  defaultRoutes?: string[];
  defaultDataModel?: { name: string; columns: string[] }[];
  uiPatterns?: string[];
  filePlan?: string[];
  creditTier?: string;
  benchmarkPromptId?: string;
};

export function enrichTemplate(t: Template): TemplateBlueprint {
  const core = getCoreTemplate(t.id);
  const quote = quoteGenerationCost({
    mode: "full_build",
    selectedModel: "gemini-flash",
    complexity: core?.complexity === "advanced" ? 8 : core?.complexity === "medium" ? 5 : 3,
    promptLength: t.prompt.length,
    expectedFiles: core?.defaultRoutes.length ?? 12,
  });

  return {
    ...t,
    estimatedCredits: quote.userCreditsRequired,
    pages: core?.defaultRoutes.map((r) => r.replace("/", "Home").replace(/^\//, "") || "Home") ?? ["Home", "Dashboard"],
    features: core?.defaultComponents ?? ["Core screens", "Navigation", "Settings"],
    requiredIntegrations: core?.backendRequirements.filter((b) => /supabase|stripe|auth/i.test(b)) ?? [],
    starterBlueprint: t.prompt.slice(0, 500),
    defaultRoutes: core?.defaultRoutes,
    defaultDataModel: core?.defaultDataModel,
    uiPatterns: core?.uiPatterns ?? getTemplateUiPatterns(t.id),
    filePlan: getTemplateFilePlan(t.id),
    creditTier: core?.creditTier,
    benchmarkPromptId: core?.benchmarkPromptId,
  };
}

export const TEMPLATE_CATALOG: TemplateBlueprint[] = templates.map(enrichTemplate);

export function getTemplateById(id: string): TemplateBlueprint | undefined {
  const resolved = resolveTemplateId(id) ?? id;
  return TEMPLATE_CATALOG.find((t) => t.id === resolved || t.id === id);
}

export function listCoreTemplates() {
  return CORE_TEMPLATES;
}

export function resolveCatalogTemplateId(id: string | null | undefined): CoreTemplateId | null {
  return resolveTemplateId(id);
}
