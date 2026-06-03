import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getVisiblePresenceForUsers } from "@/lib/presence/user-presence";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  userIds: z.array(z.string().uuid()).max(100),
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
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ error: "Server misconfiguration" }, { status: 503 });

  const statuses = await getVisiblePresenceForUsers(admin, parsed.data.userIds);
  return NextResponse.json({ statuses });
}
