import { NextResponse } from "next/server";
import { requireDreamosOwner } from "@/lib/admin/require-owner";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const owner = await requireDreamosOwner();
  if (owner.error) return owner.error;

  const body = (await request.json()) as { id?: string };
  const id = body.id?.trim();
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Service role unavailable" }, { status: 503 });
  }

  const now = new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  const { data, error } = await db
    .from("status_incidents")
    .update({ status: "resolved", resolved_at: now, updated_at: now })
    .eq("id", id)
    .select("id,title,status,resolved_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, incident: data });
}
