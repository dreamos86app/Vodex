import { NextResponse } from "next/server";
import { requireDreamosOwner } from "@/lib/admin/require-owner";
import { listAdminUsers } from "@/lib/admin/list-users";

export async function GET(req: Request) {
  const gate = await requireDreamosOwner();
  if (gate.error) return gate.error;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const plan = searchParams.get("plan")?.trim();
  const status = searchParams.get("status")?.trim();
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 1), 200);
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10) || 0, 0);

  try {
    const { users, error, warning } = await listAdminUsers({
      q: q || undefined,
      plan: plan || undefined,
      status: status || undefined,
      limit: limit + offset,
    });

    if (error) {
      return NextResponse.json(
        {
          error,
          users: [],
          hint: "Apply supabase/migrations/20260525120000_profiles_production_complete.sql on project xycqutvqxtkbszytaxbe",
        },
        { status: 500 },
      );
    }

    const page = users.slice(offset, offset + limit);

    return NextResponse.json({
      users: page,
      total: users.length,
      limit,
      offset,
      ...(warning ? { warning } : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server misconfigured";
    const status = msg.includes("not configured") ? 503 : 500;
    return NextResponse.json({ error: msg, users: [] }, { status });
  }
}
