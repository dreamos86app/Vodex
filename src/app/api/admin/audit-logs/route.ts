import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requireDreamosOwner } from "@/lib/admin/require-owner";

export async function GET() {
  const gate = await requireDreamosOwner();
  if (gate.error) return gate.error;

  try {
    const admin = createSupabaseAdmin();

    const { data: logs, error } = await admin
      .from("admin_audit_logs")
      .select(
        "id,created_at,admin_user_id,target_user_id,action,before_state,after_state,ip_address,user_agent,metadata",
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      const { data: legacy, error: legacyErr } = await admin
        .from("admin_actions")
        .select("id,created_at,admin_id,target_id,action_type,amount,reason,metadata")
        .order("created_at", { ascending: false })
        .limit(200);

      if (legacyErr) {
        return NextResponse.json({ error: legacyErr.message, logs: [] }, { status: 500 });
      }

      return NextResponse.json({
        logs: (legacy ?? []).map((l) => ({
          id: l.id,
          created_at: l.created_at,
          action: l.action_type,
          admin_user_id: l.admin_id,
          target_user_id: l.target_id,
          before_state: null,
          after_state: l.metadata,
          metadata: { amount: l.amount, reason: l.reason },
        })),
        source: "admin_actions",
      });
    }

    return NextResponse.json({ logs: logs ?? [], source: "admin_audit_logs" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server misconfigured";
    return NextResponse.json({ error: msg, logs: [] }, { status: 503 });
  }
}
