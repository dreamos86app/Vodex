import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requireDreamosOwner } from "@/lib/admin/require-owner";

export async function GET() {
  const gate = await requireDreamosOwner();
  if (gate.error) return gate.error;

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server misconfigured";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const { data, error } = await admin
    .from("analytics_events")
    .select("id,created_at,user_id,event_type,properties")
    .eq("event_type", "storage_error")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message, events: [] }, { status: 200 });
  }

  return NextResponse.json({ events: data ?? [] });
}
