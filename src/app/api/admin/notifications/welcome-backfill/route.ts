import { NextResponse } from "next/server";
import { requireDreamosOwner } from "@/lib/admin/require-owner";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ensureWelcomeNotification } from "@/lib/notifications/welcome-notification";

export const dynamic = "force-dynamic";

/** welcome-backfill: one-time welcome notification for all users missing it. */
export async function POST() {
  const owner = await requireDreamosOwner();
  if (owner.error) return owner.error;

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Service role unavailable" }, { status: 503 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;
  const { data: profiles, error } = await db.from("profiles").select("id, display_name, full_name").limit(10000);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let createdCount = 0;
  for (const p of profiles ?? []) {
    const created = await ensureWelcomeNotification(
      admin,
      p.id,
      p.display_name ?? p.full_name ?? null,
    );
    if (created) createdCount += 1;
  }

  return NextResponse.json({ ok: true, createdCount, scanned: profiles?.length ?? 0 });
}
