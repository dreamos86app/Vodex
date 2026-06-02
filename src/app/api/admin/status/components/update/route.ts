import { NextResponse } from "next/server";
import { requireDreamosOwner } from "@/lib/admin/require-owner";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isStatusSchemaMissingError, STATUS_SCHEMA_INSTALL_HINT, uptimePercentForStatus } from "@/lib/status/status-db";
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
    if (isStatusSchemaMissingError(error)) {
      return NextResponse.json({ error: STATUS_SCHEMA_INSTALL_HINT }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const today = new Date().toISOString().slice(0, 10);
  if (data?.id) {
    await db.from("status_daily_history").upsert(
      {
        component_id: data.id,
        date: today,
        status: currentStatus,
        uptime_percent: uptimePercentForStatus(currentStatus),
      },
      { onConflict: "component_id,date" },
    );
  }

  return NextResponse.json({ ok: true, component: data });
}
