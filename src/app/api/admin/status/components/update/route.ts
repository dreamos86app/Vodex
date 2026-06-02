import { NextResponse } from "next/server";
import { requireDreamosOwner } from "@/lib/admin/require-owner";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { StatusLevel } from "@/lib/status/status-types";

const LEVELS: StatusLevel[] = [
  "operational",
  "degraded",
  "partial_outage",
  "major_outage",
  "maintenance",
];

export async function POST(request: Request) {
  const owner = await requireDreamosOwner();
  if (owner.error) return owner.error;

  const body = (await request.json()) as { key?: string; currentStatus?: string };
  const key = body.key?.trim();
  const currentStatus = body.currentStatus as StatusLevel | undefined;
  if (!key || !currentStatus || !LEVELS.includes(currentStatus)) {
    return NextResponse.json({ error: "key and valid currentStatus required" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Service role unavailable" }, { status: 503 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  const { data, error } = await db
    .from("status_components")
    .update({ current_status: currentStatus, updated_at: new Date().toISOString() })
    .eq("key", key)
    .select("id,key,current_status")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, component: data });
}
