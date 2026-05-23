import { NextResponse } from "next/server";
import { requireDreamosOwner } from "@/lib/admin/require-owner";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getAdminRuntimeHealth } from "@/lib/db/admin-runtime-health";
import { getRuntimeRepairSql } from "@/lib/admin/sql/runtime-repair-sql";
import {
  buildDreamosIdentity,
  getSupabaseEnvSource,
  projectRefFromSupabaseUrl,
} from "@/lib/identity/dreamos-identity";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireDreamosOwner();
  if (gate.error) return gate.error;

  const admin = createServiceRoleClient();
  const runtimeHealth = await getAdminRuntimeHealth({ refresh: true });
  const identity = admin
    ? await buildDreamosIdentity(admin, gate.user.id, gate.user.email)
    : null;

  const { data: usage } = admin
    ? await admin
        .from("ai_usage_logs")
        .select("id, mode, model_id, status, tokens_charged, credits_charged, error_message, operation_id, created_at")
        .eq("user_id", gate.user.id)
        .order("created_at", { ascending: false })
        .limit(25)
    : { data: [] };

  const { data: events } = admin
    ? await admin
        .from("credit_events")
        .select("id, amount, reason, operation_id, created_at")
        .eq("user_id", gate.user.id)
        .order("created_at", { ascending: false })
        .limit(15)
    : { data: [] };

  return NextResponse.json({
    user_id: gate.user.id,
    accountId: identity?.accountId ?? gate.user.id,
    workspaceId: identity?.workspaceId ?? gate.user.id,
    ownerEmail: identity?.ownerEmail ?? gate.user.email ?? null,
    projectRef: projectRefFromSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
    appEnv: getSupabaseEnvSource(),
    checked_at: new Date().toISOString(),
    runtime_health: runtimeHealth,
    sql_patch_chars: getRuntimeRepairSql().length,
    recent_ai_usage: usage ?? [],
    recent_credit_events: events ?? [],
    env: {
      has_service_role: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      has_openai: Boolean(process.env.OPENAI_API_KEY),
      has_anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
      has_google: Boolean(
        process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim(),
      ),
    },
  });
}
