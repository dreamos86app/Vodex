import { z } from "zod";
import { rejectBannedRefs } from "@/lib/ai/file-fingerprint";

export const BlueprintQualityLevel = z.enum(["quick", "standard", "production", "premium"]);
export const BlueprintSourceMode = z.enum([
  "deterministic_quick",
  "llm_enriched",
  "template_assisted",
  "admin_override",
]);

const RouteEntry = z.object({ route: z.string().min(1), purpose: z.string().min(1) });
const TableEntry = z.object({ name: z.string(), columns: z.array(z.string()) });
const EnvEntry = z.object({
  key: z.string(),
  public: z.boolean(),
  example: z.string().optional(),
});

export const AppBlueprintSchema = z.object({
  appName: z.string().min(1).max(80),
  appType: z.string().min(1),
  oneSentencePitch: z.string().min(1),
  targetUsers: z.string().min(1),
  primaryUserJobs: z.array(z.string()).min(1),
  pages: z.array(RouteEntry).min(1),
  routeMap: z.array(RouteEntry).min(1),
  componentMap: z.array(z.string()).default([]),
  dataModel: z.array(TableEntry).default([]),
  authModel: z.string(),
  permissionsModel: z.string().optional(),
  adminModel: z.string().optional(),
  integrations: z.array(z.string()).default([]),
  requiredEnvVars: z.array(EnvEntry).default([]),
  designSystem: z.string(),
  responsiveStrategy: z.string(),
  emptyStates: z.array(z.string()).default([]),
  loadingStates: z.array(z.string()).default([]),
  errorStates: z.array(z.string()).default([]),
  monetizationAssumptions: z.array(z.string()).default([]),
  deploymentAssumptions: z.array(z.string()).default([]),
  estimatedComplexity: z.number().min(1).max(10),
  estimatedUserCredits: z.number().min(1),
  costSavingStrategy: z.string().optional(),
  qualityLevel: BlueprintQualityLevel,
  sourceMode: BlueprintSourceMode,
  templateId: z.string().nullable().optional(),
  risks: z.array(z.string()).default([]),
  exclusions: z.array(z.string()).default([]),
  acceptanceCriteria: z.array(z.string()).default([]),
  buildStages: z.array(z.string()).min(1),
  buildConfidence: z.number().min(0).max(100).optional(),
  category: z.string().optional(),
  apiActionsPlan: z.array(z.string()).default([]),
  uiRequirements: z.array(z.string()).default([]),
  mobileStrategy: z.string().optional(),
  qualityChecklist: z.array(z.string()).default([]),
  backendRequirements: z.array(z.string()).default([]),
  previewAssumptions: z.array(z.string()).default([]),
  publishAssumptions: z.array(z.string()).default([]),
  templateInfluence: z.string().optional(),
  styleInfluence: z.string().optional(),
  /** @deprecated use oneSentencePitch */
  corePromise: z.string().optional(),
  authRequired: z.boolean().optional(),
  adminRequired: z.boolean().optional(),
  designDirection: z.string().optional(),
  databaseTables: z.array(TableEntry).optional(),
  deployAssumptions: z.array(z.string()).optional(),
  excludedFromBuild: z.array(z.string()).optional(),
  components: z.array(z.string()).optional(),
  complexity: z.number().optional(),
});

export type AppBlueprint = z.infer<typeof AppBlueprintSchema>;
export type BlueprintQualityLevel = z.infer<typeof BlueprintQualityLevel>;

const SECRET_PATTERN = /(service_role|secret_key|password\s*[:=]|api[_-]?key\s*[:=]\s*['"]?[a-z0-9]{20})/i;
const MODEL_LEAK = /\b(gpt-4o-mini|claude-opus|gemini-flash|route_reason)\b/i;

export function sanitizeBlueprintForUser(blueprint: AppBlueprint): AppBlueprint {
  const copy = { ...blueprint };
  delete (copy as { adminBreakdown?: unknown }).adminBreakdown;
  return copy;
}

export function validateBlueprintContent(blueprint: AppBlueprint): string | null {
  const json = JSON.stringify(blueprint);
  const banned = rejectBannedRefs(json);
  if (banned) return banned;
  if (SECRET_PATTERN.test(json)) return "Blueprint cannot contain secrets";
  if (MODEL_LEAK.test(json)) return "Blueprint cannot expose internal model names";
  if (/deployed successfully|already live on vercel/i.test(json)) {
    return "Blueprint cannot claim deployment is complete";
  }
  if (blueprint.pages.length < 1 || blueprint.routeMap.length < 1) {
    return "Blueprint must include pages and routes";
  }
  return null;
}

export function parseAppBlueprint(raw: unknown): { ok: true; blueprint: AppBlueprint } | { ok: false; error: string } {
  const parsed = AppBlueprintSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  }
  const bp = parsed.data;
  const contentErr = validateBlueprintContent(bp);
  if (contentErr) return { ok: false, error: contentErr };
  return { ok: true, blueprint: bp };
}

export function requiresBlueprintApproval(quality: BlueprintQualityLevel): boolean {
  return quality === "standard" || quality === "production" || quality === "premium";
}
