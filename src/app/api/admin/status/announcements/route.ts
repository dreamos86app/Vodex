import { NextResponse } from "next/server";
import { requireDreamosOwner } from "@/lib/admin/require-owner";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export async function GET() {
  const owner = await requireDreamosOwner();
  if (owner.error) return owner.error;

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Service role unavailable" }, { status: 503 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  const { data, error } = await db
    .from("platform_announcements")
    .select("id,title,message,severity,is_active,starts_at,ends_at,created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ announcements: data ?? [] });
}
