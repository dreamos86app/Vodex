import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { CertificationCheck, CertificationContext } from "@/lib/certification/types";

const RUNTIME_TABLES = [
  "app_user_profiles",
  "app_analytics_events",
  "app_integration_connections",
  "app_payment_events",
  "published_apps",
] as const;

export async function runDataCertificationChecks(
  ctx: CertificationContext,
): Promise<CertificationCheck[]> {
  const checks: CertificationCheck[] = [];
  const admin = createServiceRoleClient();
  if (!admin) {
    checks.push({
      id: "data_service_role",
      section: "data",
      title: "Database access",
      status: "warning",
      weight: 6,
      detail: "Cannot verify runtime tables without service role.",
    });
    return checks;
  }

  for (const table of RUNTIME_TABLES) {
    const { error } = await admin.from(table as never).select("id").limit(1);
    if (error) {
      const denied = /permission denied|does not exist/i.test(error.message);
      checks.push({
        id: `data_table_${table}`,
        section: "data",
        title: `Table: ${table}`,
        status: denied ? "blocker" : "warning",
        weight: 4,
        detail: error.message.slice(0, 120),
        fix: denied
          ? `Apply P4.3+ migrations granting access to ${table}.`
          : "Check Supabase migration status.",
      });
    } else {
      checks.push({
        id: `data_table_${table}`,
        section: "data",
        title: `Table: ${table}`,
        status: "passed",
        weight: 2,
        detail: "Readable via service role.",
      });
    }
  }

  if (ctx.published) {
    const { count, error } = await admin
      .from("app_user_profiles" as never)
      .select("id", { count: "exact", head: true })
      .eq("project_id", ctx.projectId);
    if (error) {
      checks.push({
        id: "data_profiles_rls",
        section: "data",
        title: "User profiles RLS",
        status: "warning",
        weight: 5,
        detail: error.message,
      });
    } else {
      checks.push({
        id: "data_profiles",
        section: "data",
        title: "User profiles",
        status: "passed",
        weight: 3,
        detail: `${count ?? 0} profile(s) — empty is OK before first signup.`,
      });
    }
  }

  return checks;
}
