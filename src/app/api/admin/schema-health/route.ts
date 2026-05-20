import { NextResponse } from "next/server";
import { requireDreamosOwner } from "@/lib/admin/require-owner";
import { checkRuntimeSchemaHealth } from "@/lib/db/schema-health";
import {
  bustAdminSchemaHealthCache,
  getCachedAdminSchemaHealth,
} from "@/lib/cache/admin-schema-health-cache";

export async function GET(req: Request) {
  const gate = await requireDreamosOwner();
  if (gate.error) return gate.error;

  const force = new URL(req.url).searchParams.get("refresh") === "1";
  if (force) bustAdminSchemaHealthCache();

  try {
    const report = await getCachedAdminSchemaHealth(checkRuntimeSchemaHealth, force);
    return NextResponse.json(report, {
      status: report.ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "schema_health_failed";
    return NextResponse.json(
      {
        ok: false,
        missing: [],
        projectRef: null,
        checkedAt: new Date().toISOString(),
        error: msg,
        migrationHint:
          "Run scripts/admin-column-compat.sql in Supabase SQL Editor, then NOTIFY pgrst, 'reload schema';",
      },
      { status: 503 },
    );
  }
}
