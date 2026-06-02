import { NextResponse } from "next/server";
import { requireDreamosOwner } from "@/lib/admin/require-owner";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const owner = await requireDreamosOwner();
  if (owner.error) return owner.error;

  const body = (await request.json()) as {
    title?: string;
    message?: string;
    severity?: string;
    status?: string;
    affectedComponents?: string[];
  };

  const title = body.title?.trim();
  const message = body.message?.trim();
  if (!title || !message) {
    return NextResponse.json({ error: "title and message required" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Service role unavailable" }, { status: 503 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  const { data, error } = await db
    .from("status_incidents")
    .insert({
      title,
      message,
      severity: body.severity ?? "incident",
      status: body.status ?? "investigating",
      affected_components: body.affectedComponents ?? [],
      is_public: true,
      created_by: owner.user.id,
    })
    .select("id,title,status,started_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, incident: data });
}
