import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { filterGroupMessageBody } from "@/lib/community/group-message-filter";
import { parseMentionUsernames } from "@/lib/community/parse-mentions";
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

  const body = (await req.json()) as { text?: string; parentMessageId?: string | null };
  const text = body.text?.trim();
  if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });

  const filtered = filterGroupMessageBody(text);
  if (!filtered.ok) return NextResponse.json({ error: filtered.reason }, { status: 400 });

  const { data: member } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const { data: inserted, error } = await supabase
    .from("group_messages" as never)
    .insert({
      group_id: groupId,
      user_id: user.id,
      body: text,
      parent_message_id: body.parentMessageId ?? null,
    } as never)
    .select("id, body, created_at, user_id, parent_message_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const messageId = (inserted as { id: string }).id;
  const handles = parseMentionUsernames(text);
  if (handles.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username")
      .in("username", handles);
    const admin = createServiceRoleClient();
    for (const p of profiles ?? []) {
      if (!p.username || p.id === user.id) continue;
      await (supabase as any).from("group_message_mentions").insert({
        message_id: messageId,
        mentioned_user_id: p.id,
      });
      if (admin) {
        await notifyCommunityEvent(admin, {
          userId: p.id,
          kind: "group_mention",
          title: "You were mentioned in group chat",
          body: text.slice(0, 120),
          actionUrl: `/community/groups/${groupId}`,
          metadata: { group_id: groupId, message_id: messageId },
        });
      }
    }
  }

  return NextResponse.json({ ok: true, message: inserted });
}
