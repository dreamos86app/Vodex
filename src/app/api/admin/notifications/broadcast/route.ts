import { NextResponse } from "next/server";
import { requireDreamosOwner } from "@/lib/admin/require-owner";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const owner = await requireDreamosOwner();
  if (owner.error) return owner.error;

  const body = (await request.json()) as {
    title?: string;
    message?: string;
    category?: string;
    actionLabel?: string;
    actionUrl?: string;
    playSound?: boolean;
    targetEmail?: string;
    templateId?: string;
    iconKey?: string;
    effectKey?: string;
  };

  const title = body.title?.trim();
  const message = body.message?.trim();
  if (!title || !message) {
    return NextResponse.json({ error: "title and message required" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Service role unavailable" }, { status: 503 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any;

  let userIds: string[] = [];
  if (body.targetEmail?.trim()) {
    const { data: profile } = await db
      .from("profiles")
      .select("id")
      .eq("email", body.targetEmail.trim().toLowerCase())
      .maybeSingle();
    if (!profile?.id) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    userIds = [profile.id];
  } else {
    const { data: profiles } = await db.from("profiles").select("id").limit(5000);
    userIds = (profiles ?? []).map((p: { id: string }) => p.id);
  }

  const rows = userIds.map((userId) => ({
    user_id: userId,
    type: body.category ?? "system",
    title,
    body: message,
    read: false,
    action_url: body.actionUrl ?? null,
    metadata: {
      kind: "admin_broadcast",
      play_sound: body.playSound !== false,
      premium: true,
      template_id: body.templateId ?? "custom",
      icon_key: body.iconKey ?? "bell",
      effect_key: body.effectKey ?? "glow",
    },
  }));

  if (rows.length === 0) {
    return NextResponse.json({ error: "No recipients" }, { status: 400 });
  }

  const { error } = await db.from("notifications").insert(rows);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await db.from("admin_broadcasts").insert({
    title,
    body: message,
    category: body.category ?? "system",
    action_label: body.actionLabel ?? null,
    action_url: body.actionUrl ?? null,
    play_sound: body.playSound !== false,
    target_scope: body.targetEmail ? "single" : "all_existing",
    recipient_count: rows.length,
    created_by: owner.user.id,
  });

  return NextResponse.json({ ok: true, recipientCount: rows.length });
}
