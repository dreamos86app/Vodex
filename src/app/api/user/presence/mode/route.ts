import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  getOwnPresenceSnapshot,
  normalizePresenceMode,
  upsertPresenceHeartbeat,
} from "@/lib/presence/user-presence";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  mode: z.enum(["auto", "online", "offline", "invisible"]),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  const mode = normalizePresenceMode(parsed.data.mode);
  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ error: "Server misconfiguration" }, { status: 503 });

  const { error } = await admin
    .from("profiles")
    .update({ presence_mode: mode } as never)
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (mode === "online") {
    await upsertPresenceHeartbeat(admin, user.id);
  }

  const snapshot = await getOwnPresenceSnapshot(admin, user.id);
  return NextResponse.json(snapshot);
}
