import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { userId?: string };
  const newOwnerId = body.userId?.trim();
  if (!newOwnerId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const { data: group } = await supabase.from("groups").select("creator_id").eq("id", groupId).maybeSingle();
  if (!group || group.creator_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: member } = await supabase
    .from("group_members")
    .select("user_id")
    .eq("group_id", groupId)
    .eq("user_id", newOwnerId)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "User is not a member" }, { status: 400 });

  const { error: updateErr } = await supabase
    .from("groups")
    .update({ creator_id: newOwnerId })
    .eq("id", groupId);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 });

  await supabase.from("group_members").update({ role: "admin" }).eq("group_id", groupId).eq("user_id", newOwnerId);
  await supabase.from("group_members").update({ role: "member" }).eq("group_id", groupId).eq("user_id", user.id);

  return NextResponse.json({ ok: true });
}
