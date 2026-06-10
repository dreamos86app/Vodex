import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { notifyCommunityEvent } from "@/lib/community/community-notifications";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    userId?: string;
    sanctionType?: "ban" | "timeout";
    reason?: string;
    until?: string;
  };
  const targetUserId = body.userId?.trim();
  const sanctionType = body.sanctionType ?? "ban";
  if (!targetUserId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const { data: group } = await supabase.from("groups").select("creator_id, name").eq("id", groupId).maybeSingle();
  if (!group || group.creator_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const until =
    sanctionType === "timeout"
      ? body.until ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      : null;

  const { error: sanctionErr } = await (supabase as any).from("group_member_sanctions").upsert(
    {
      group_id: groupId,
      user_id: targetUserId,
      actor_id: user.id,
      sanction_type: sanctionType,
      reason: body.reason ?? null,
      until,
    },
    { onConflict: "group_id,user_id,sanction_type" },
  );
  if (sanctionErr) return NextResponse.json({ error: sanctionErr.message }, { status: 400 });

  await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", targetUserId);

  const admin = createServiceRoleClient();
  if (admin) {
    await notifyCommunityEvent(admin, {
      userId: targetUserId,
      kind: "group_banned",
      title: sanctionType === "timeout" ? `Timed out in ${group.name}` : `Banned from ${group.name}`,
      body: body.reason ?? "A moderator restricted your access to this group.",
      actionUrl: "/community",
      metadata: { group_id: groupId, sanction_type: sanctionType },
    });
  }

  return NextResponse.json({ ok: true });
}
