import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  REQUIRED_COLUMNS,
  REQUIRED_RPCS,
  REQUIRED_TABLES,
  RUNTIME_MIGRATION_FILE,
  RUNTIME_SQL_FALLBACK,
} from "@/lib/schema/runtime-required-schema";

async function columnExists(
  admin: NonNullable<ReturnType<typeof createServiceRoleClient>>,
  table: string,
  column: string,
): Promise<boolean> {
  const { error } = await admin.from(table as "projects").select(column).limit(0);
  if (!error) return true;
  const m = error.message.toLowerCase();
  return !m.includes("column") && !m.includes("schema cache") && !m.includes("does not exist");
}

async function tableExists(
  admin: NonNullable<ReturnType<typeof createServiceRoleClient>>,
  table: string,
): Promise<boolean> {
  const { error } = await admin.from(table as "projects").select("id").limit(0);
  if (!error) return true;
  const m = error.message.toLowerCase();
  return !m.includes("could not find the table") && !m.includes("does not exist") && error.code !== "42P01";
}

export async function checkBuilderSchemaHealth() {
  const admin = createServiceRoleClient();
  if (!admin) {
    return {
      ok: false,
      migration_file: RUNTIME_MIGRATION_FILE,
      fallback_script: RUNTIME_SQL_FALLBACK,
      error: "SUPABASE_SERVICE_ROLE_KEY missing — cannot inspect schema",
      missing_tables: [] as string[],
      missing_columns: [] as string[],
      missing_rpcs: [] as string[],
    };
  }

  const missingTables: string[] = [];
  const missingColumns: string[] = [];
  const missingRpcs: string[] = [];

  for (const table of REQUIRED_TABLES) {
    if (!(await tableExists(admin, table))) missingTables.push(table);
  }

  for (const [table, cols] of Object.entries(REQUIRED_COLUMNS)) {
    if (missingTables.includes(table)) continue;
    for (const col of cols) {
      if (!(await columnExists(admin, table, col))) {
        missingColumns.push(`${table}.${col}`);
      }
    }
  }

  for (const rpc of REQUIRED_RPCS) {
    let probe: Record<string, unknown>;
    if (rpc === "charge_credits" || rpc === "charge_tokens") {
      probe = {
        p_user_id: "00000000-0000-0000-0000-000000000000",
        p_amount: 0,
        p_reason: "health_check",
        p_idempotency_key: `health_${rpc}`,
        p_metadata: {},
      };
    } else if (rpc === "grant_tokens") {
      probe = {
        p_user_id: "00000000-0000-0000-0000-000000000000",
        p_amount: 0,
        p_reason: "health_check",
        p_idempotency_key: `health_${rpc}`,
        p_metadata: {},
        p_source: "adjustment",
      };
    } else if (rpc === "grant_credits" || rpc === "grant_credits_admin") {
      probe = {
        p_admin_id: "00000000-0000-0000-0000-000000000000",
        p_user_id: "00000000-0000-0000-0000-000000000000",
        p_amount: 0,
        p_reason: "health_check",
      };
    } else if (rpc === "complete_user_onboarding") {
      probe = {
        p_user_id: "00000000-0000-0000-0000-000000000000",
        p_hear_about: "probe",
        p_build_first: "probe",
        p_replay: false,
      };
    } else {
      probe = { p_referred_id: "00000000-0000-0000-0000-000000000000", p_credits: 0 };
    }

    const { error } = await admin.rpc(rpc as "charge_tokens", probe as never);
    if (error?.message?.includes("Could not find the function")) {
      missingRpcs.push(rpc);
    }
  }

  const ok =
    missingTables.length === 0 && missingColumns.length === 0 && missingRpcs.length === 0;

  return {
    ok,
    migration_file: RUNTIME_MIGRATION_FILE,
    fallback_script: RUNTIME_SQL_FALLBACK,
    missing_tables: missingTables,
    missing_columns: missingColumns,
    missing_rpcs: missingRpcs,
    hint: ok
      ? "Runtime schema looks healthy."
      : `Apply ${RUNTIME_MIGRATION_FILE} or ${RUNTIME_SQL_FALLBACK} in Supabase SQL Editor, then NOTIFY pgrst, 'reload schema';`,
  };
}
