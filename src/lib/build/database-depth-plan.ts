import type { AppBlueprint } from "@/lib/build/blueprint-schema";
import { buildBackendPlan } from "@/lib/build/backend-plan";

export type DatabaseDepthPlan = {
  tables: AppBlueprint["dataModel"];
  relationships: string[];
  indexes: string[];
  ownershipModel: string;
  rlsPolicies: string[];
  seedDataNotes: string[];
  migrationHonesty: string;
};

export function buildDatabaseDepthPlan(blueprint: AppBlueprint): DatabaseDepthPlan {
  const backend = buildBackendPlan(blueprint);
  const tables = backend.entities;
  const relationships: string[] = [];
  for (const t of tables) {
    if (t.columns.some((c) => c.endsWith("_id"))) {
      relationships.push(`${t.name} references parent entity via foreign keys`);
    }
  }
  const indexes = tables.flatMap((t) => {
    const cols: string[] = [];
    if (t.columns.includes("owner_id") || t.columns.includes("user_id")) cols.push(`${t.name}(user_id)`);
    if (t.columns.includes("status")) cols.push(`${t.name}(status)`);
    if (t.columns.includes("created_at")) cols.push(`${t.name}(created_at DESC)`);
    return cols;
  });

  return {
    tables,
    relationships,
    indexes,
    ownershipModel: blueprint.permissionsModel ?? blueprint.authModel ?? "Public read where safe",
    rlsPolicies: backend.rlsExpectations,
    seedDataNotes: [
      "Seed 3–5 realistic rows per table for preview",
      "No lorem ipsum — use domain-specific labels from blueprint",
    ],
    migrationHonesty:
      "Schema plan is generated for review; live migrations require connected Supabase — never claim DB is live in preview",
  };
}
