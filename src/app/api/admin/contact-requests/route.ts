import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requireDreamosOwner } from "@/lib/admin/require-owner";
import { logAdminAudit } from "@/lib/admin/audit-log";

const patchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["new", "read", "resolved"]),
});

export async function GET(req: Request) {
  const gate = await requireDreamosOwner();
  if (gate.error) return gate.error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const reason = searchParams.get("reason");
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 1), 200);
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10) || 0, 0);

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server misconfigured";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  let query = admin
    .from("contact_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status && ["new", "read", "resolved"].includes(status)) {
    query = query.eq("status", status);
  }
  if (reason) {
    query = query.eq("reason", reason);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message, requests: [] }, { status: 200 });
  }

  return NextResponse.json({ requests: data ?? [], limit, offset });
}

export async function PATCH(request: Request) {
  const gate = await requireDreamosOwner();
  if (gate.error) return gate.error;
  const { user } = gate;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server misconfigured";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const { data, error } = await admin
    .from("contact_requests")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (data?.user_id) {
    await logAdminAudit(user, "contact_request_status", {
      targetUserId: data.user_id,
      metadata: { requestId: parsed.data.id, status: parsed.data.status },
    });
  }

  return NextResponse.json({ request: data });
}
