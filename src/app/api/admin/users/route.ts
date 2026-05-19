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

  try {
    const { users, error } = await listAdminUsers({
      q: q || undefined,
      plan: plan || undefined,
      status: status || undefined,
    });

    if (error) {
      return NextResponse.json({ error, users: [] }, { status: 500 });
    }

    return NextResponse.json({ users, total: users.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server misconfigured";
    const status = msg.includes("not configured") ? 503 : 500;
    return NextResponse.json({ error: msg, users: [] }, { status });
  }
}
