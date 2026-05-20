import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requireDreamosOwner } from "@/lib/admin/require-owner";
import { fetchAdminActions, parseAdminPagination } from "@/lib/admin/admin-query-compat";

export async function GET(req: Request) {
  const gate = await requireDreamosOwner();
  if (gate.error) return gate.error;

  const { limit, offset } = parseAdminPagination(new URL(req.url).searchParams);

  try {
    const admin = createSupabaseAdmin();

    const { data: logs, error } = await admin
      .from("admin_audit_logs")
      .select(
        "id,created_at,admin_user_id,target_user_id,action,before_state,after_state,ip_address,user_agent,metadata",
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (!error) {
      return NextResponse.json({
        logs: logs ?? [],
        source: "admin_audit_logs",
        limit,
        offset,
      });
    }

    const legacy = await fetchAdminActions(admin, { limit, offset });
    if (legacy.error) {
      return NextResponse.json(
        {
          error: legacy.error,
          logs: [],
          hint: "Run scripts/admin-column-compat.sql then NOTIFY pgrst, 'reload schema';",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      logs: legacy.rows.map((l) => ({
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
      limit,
      offset,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server misconfigured";
    return NextResponse.json({ error: msg, logs: [] }, { status: 503 });
  }
}
