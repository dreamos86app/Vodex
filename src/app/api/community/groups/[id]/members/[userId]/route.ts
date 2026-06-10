import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { notifyCommunityEvent } from "@/lib/community/community-notifications";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; userId: string }> },
) {
  const { id: groupId, userId: targetUserId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: group } = await supabase.from("groups").select("creator_id, name").eq("id", groupId).maybeSingle();
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isCreator = group.creator_id === user.id;
  const { data: adminRow } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!isCreator && adminRow?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (targetUserId === group.creator_id) {
    return NextResponse.json({ error: "Cannot remove group owner" }, { status: 400 });
  }

  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", targetUserId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const admin = createServiceRoleClient();
  if (admin && targetUserId !== user.id) {
    await notifyCommunityEvent(admin, {
      userId: targetUserId,
      kind: "group_kicked",
      title: `Removed from ${group.name}`,
      body: "You were removed from a group by a moderator.",
      actionUrl: "/community",
      metadata: { group_id: groupId },
    });
  }

  return NextResponse.json({ ok: true });
}
