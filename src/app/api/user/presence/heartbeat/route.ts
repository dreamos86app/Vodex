import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  getOwnPresenceSnapshot,
  upsertPresenceHeartbeat,
} from "@/lib/presence/user-presence";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ error: "Server misconfiguration" }, { status: 503 });

  await upsertPresenceHeartbeat(admin, user.id);
  const snapshot = await getOwnPresenceSnapshot(admin, user.id);

  return NextResponse.json({
    ok: true,
    presenceMode: snapshot.presenceMode,
    visibleStatus: snapshot.visibleStatus,
    label: snapshot.label,
  });
}
