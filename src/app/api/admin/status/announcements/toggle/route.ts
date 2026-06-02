import { NextResponse } from "next/server";
import { requireDreamosOwner } from "@/lib/admin/require-owner";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { isStatusSchemaMissingError, STATUS_SCHEMA_INSTALL_HINT } from "@/lib/status/status-db";

export async function POST(request: Request) {
  const owner = await requireDreamosOwner();
  if (owner.error) return owner.error;

  const body = (await request.json()) as { id?: string; isActive?: boolean };
  const id = body.id?.trim();
  if (!id || typeof body.isActive !== "boolean") {
    return NextResponse.json({ error: "id and isActive required" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Service role unavailable" }, { status: 503 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  const { error } = await db
    .from("platform_announcements")
    .update({ is_active: body.isActive, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    if (isStatusSchemaMissingError(error)) {
      return NextResponse.json({ error: STATUS_SCHEMA_INSTALL_HINT }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
