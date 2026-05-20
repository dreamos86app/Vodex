import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requireDreamosOwner } from "@/lib/admin/require-owner";
import { fetchAiUsageLogs, parseAdminPagination } from "@/lib/admin/admin-query-compat";

export async function GET(req: Request) {
  const gate = await requireDreamosOwner();
  if (gate.error) return gate.error;

  const { limit, offset } = parseAdminPagination(new URL(req.url).searchParams);

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server misconfigured";
    return NextResponse.json({ error: msg, events: [] }, { status: 503 });
  }

  const { rows, error, columnHint } = await fetchAiUsageLogs(admin, { limit, offset });

  if (error) {
    return NextResponse.json(
      {
        error,
        events: [],
        hint: "Run scripts/admin-column-compat.sql then NOTIFY pgrst, 'reload schema';",
      },
      { status: 200 },
    );
  }

  return NextResponse.json({
    events: rows,
    limit,
    offset,
    ...(columnHint ? { warning: columnHint } : {}),
  });
}
