import type { AppBlueprint } from "@/lib/build/blueprint-schema";

export type BackendPlan = {
  requiresBackend: boolean;
  entities: AppBlueprint["dataModel"];
  rlsExpectations: string[];
  crudActions: string[];
  validationRules: string[];
  previewMockStrategy: string;
  userConfigurationChecklist: string[];
  honestLimitations: string[];
};

export function detectBackendRequired(blueprint: AppBlueprint): boolean {
  const auth = /\b(supabase|auth|login|user|admin|rls)\b/i.test(
    JSON.stringify(blueprint),
  );
  const tables = (blueprint.dataModel?.length ?? 0) > 0;
  const backendReq = (blueprint.backendRequirements?.length ?? 0) > 0;
  return auth || tables || backendReq;
}

export function buildBackendPlan(blueprint: AppBlueprint): BackendPlan {
  const requiresBackend = detectBackendRequired(blueprint);
  const entities = blueprint.dataModel ?? [];
  const rlsExpectations: string[] = [];
  if (blueprint.authModel && !/public|optional|n\/a/i.test(blueprint.authModel)) {
    rlsExpectations.push("Enable RLS on all user-owned tables");
    rlsExpectations.push("Policies: auth.uid() = owner_id for SELECT/INSERT/UPDATE/DELETE");
  }
  if (blueprint.adminModel && !/none/i.test(blueprint.adminModel)) {
    rlsExpectations.push("Admin role bypass or separate admin policies for /admin routes");
  }
  for (const req of blueprint.backendRequirements ?? []) {
    if (/rls/i.test(req)) rlsExpectations.push(req);
  }

  const crudActions =
    (blueprint as { apiActionsPlan?: string[] }).apiActionsPlan?.length
      ? (blueprint as { apiActionsPlan: string[] }).apiActionsPlan
      : entities.map((e) => `CRUD on ${e.name}`);

  return {
    requiresBackend,
    entities,
    rlsExpectations,
    crudActions,
    validationRules: ["Required fields on forms", "Server-side validation on mutations"],
    previewMockStrategy: "Use lib/mock-data.ts and preview-safe fixtures until Supabase is connected",
    userConfigurationChecklist: [
      "Connect Supabase project in Settings → Integrations",
      "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "Run migrations when provided — do not fake live DB",
    ],
    honestLimitations: requiresBackend
      ? ["Preview runs with mock data", "Live backend requires user Supabase configuration"]
      : ["Static/frontend-only app — no live database required"],
  };
}
