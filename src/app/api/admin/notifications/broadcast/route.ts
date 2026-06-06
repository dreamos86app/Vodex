import { NextResponse } from "next/server";
import { requireDreamosOwner } from "@/lib/admin/require-owner";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  notificationMatchesTab,
  readNotificationKind,
} from "@/lib/notifications/notification-kinds";
import {
  getOwnerUserIdForBroadcast,
  insertAdminBroadcastNotifications,
  resolveBroadcastRecipientIds,
  verifyNotificationsReadable,
} from "@/lib/notifications/notification-service";
import type { Notification } from "@/lib/supabase/types";

type TargetPlan = "all" | "free" | "starter" | "pro" | "infinity";

const INSERT_CHUNK = 400;

function planMatches(planId: string | null | undefined, target: TargetPlan): boolean {
  if (target === "all") return true;
  const p = (planId ?? "free").toLowerCase();
  if (target === "free") return p === "free";
  if (target === "starter") return p === "starter";
  if (target === "pro") return p === "pro";
  if (target === "infinity") return p.startsWith("infinity") || p === "enterprise";
  return true;
}

async function resolveUserByEmail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  email: string,
): Promise<{ id: string; plan_id?: string } | null> {
  const normalized = email.trim().toLowerCase();
  const { data: profile } = await db
    .from("profiles")
    .select("id, plan_id")
    .eq("email", normalized)
    .maybeSingle();
  if (profile?.id) return profile;

  const getByEmail = db.auth?.admin?.getUserByEmail;
  if (typeof getByEmail === "function") {
    const { data: authUser, error: authErr } = await getByEmail.call(db.auth.admin, normalized);
    if (!authErr && authUser?.user?.id) {
      const { data: byId } = await db
        .from("profiles")
        .select("id, plan_id")
        .eq("id", authUser.user.id)
        .maybeSingle();
      return byId?.id ? byId : { id: authUser.user.id, plan_id: "free" };
    }
  }

  return null;
}

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
    targetPlan?: TargetPlan;
    templateId?: string;
    iconKey?: string;
    effectKey?: string;
    design?: {
      backgroundPreset?: string;
      effectPreset?: string;
      iconPreset?: string;
      animatedIconEnabled?: boolean;
      textColor?: string;
      accentColor?: string;
      outlineColor?: string;
    };
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

  let profiles: Array<{ id: string; plan_id?: string }> = [];

  if (body.targetEmail?.trim()) {
    const profile = await resolveUserByEmail(db, body.targetEmail);
    if (!profile?.id) {
      return NextResponse.json(
        { error: "No matching users found.", recipientCount: 0 },
        { status: 404 },
      );
    }
    profiles = [profile];
  } else {
    const { data: rows, error: profilesErr } = await db
      .from("profiles")
      .select("id, plan_id")
      .limit(10000);
    if (profilesErr) {
      return NextResponse.json({ error: profilesErr.message }, { status: 500 });
    }
    const targetPlan = (body.targetPlan ?? "all") as TargetPlan;
    profiles = (rows ?? []).filter((p: { id: string; plan_id?: string }) =>
      planMatches(p.plan_id, targetPlan),
    );
  }

  const ownerProfileId = owner.user.id;
  const platformOwnerId = (await getOwnerUserIdForBroadcast(db)) ?? ownerProfileId;
  const userIds = await resolveBroadcastRecipientIds({
    db,
    profileIds: profiles.map((p) => p.id),
    ownerUserId: platformOwnerId,
  });
  if (userIds.length === 0) {
    return NextResponse.json(
      { error: "No matching users found.", recipientCount: 0 },
      { status: 400 },
    );
  }

  const rowTemplate = {
    type: body.category === "credit" ? "credit" : "system",
    title,
    body: message,
    read: false,
    action_url: body.actionUrl ?? null,
    metadata: {
      kind: "admin_message",
      play_sound: body.playSound !== false,
      premium: true,
      template_id: body.templateId ?? "custom",
      icon_key: body.design?.iconPreset ?? body.iconKey ?? "megaphone",
      icon_preset: body.design?.iconPreset ?? body.iconKey ?? "megaphone",
      effect_key: body.design?.effectPreset ?? body.effectKey ?? "glow_pulse",
      effect_preset: body.design?.effectPreset ?? body.effectKey ?? "glow_pulse",
      background_preset: body.design?.backgroundPreset,
      text_color: body.design?.textColor,
      accent_color: body.design?.accentColor,
      outline_color: body.design?.outlineColor,
      animated_icon: body.design?.animatedIconEnabled,
    },
  };

  let inserted = 0;
  const insertedUserIds: string[] = [];
  for (let i = 0; i < userIds.length; i += INSERT_CHUNK) {
    const chunkIds = userIds.slice(i, i + INSERT_CHUNK);
    const rows = chunkIds.map((userId: string) => ({
      user_id: userId,
      ...rowTemplate,
    }));
    const { data: insertedRows, error } = await db
      .from("notifications")
      .insert(rows)
      .select("id, user_id");
    if (error) {
      return NextResponse.json(
        { error: error.message, recipientCount: inserted, insertedCount: inserted },
        { status: 500 },
      );
    }
    const count = insertedRows?.length ?? rows.length;
    inserted += count;
    for (const row of insertedRows ?? []) {
      if (row.user_id) insertedUserIds.push(row.user_id);
    }
  }

  const verifyUserId = insertedUserIds[0] ?? userIds[0];
  const sampleNotificationIds: string[] = [];
  let readableCount = 0;
  let visibleOnMain = false;
  let visibleOnAll = false;

  if (verifyUserId) {
    const { data: sampleRows } = await db
      .from("notifications")
      .select("id, user_id, title, body, type, read, metadata, created_at")
      .eq("user_id", verifyUserId)
      .eq("title", title)
      .order("created_at", { ascending: false })
      .limit(5);
    for (const row of sampleRows ?? []) {
      if (row.id) sampleNotificationIds.push(row.id);
    }
    readableCount = sampleRows?.length ?? 0;
    const sample = sampleRows?.[0] as Notification | undefined;
    if (sample) {
      visibleOnMain = notificationMatchesTab(sample, "main");
      visibleOnAll = notificationMatchesTab(sample, "all");
      if (!visibleOnMain) {
        const kind = readNotificationKind(sample);
        return NextResponse.json(
          {
            error:
              "Notification was inserted but would be hidden on the Main inbox tab. Fix metadata.kind or category.",
            insertedCount: inserted,
            recipientCount: inserted,
            verifySampleUserId: verifyUserId,
            sampleNotificationIds,
            visibleOnMain,
            visibleOnAll,
            detectedKind: kind,
          },
          { status: 422 },
        );
      }
    }
  }

  if (inserted === 0) {
    return NextResponse.json(
      { error: "No notifications were inserted.", recipientCount: 0, insertedCount: 0 },
      { status: 500 },
    );
  }

  const { error: auditErr } = await db.from("admin_broadcasts").insert({
    title,
    body: message,
    category: body.category ?? "system",
    action_label: body.actionLabel ?? null,
    action_url: body.actionUrl ?? null,
    play_sound: body.playSound !== false,
    target_scope: body.targetEmail
      ? "single"
      : body.targetPlan && body.targetPlan !== "all"
        ? `plan:${body.targetPlan}`
        : "all_existing",
    target_plan: body.targetPlan ?? null,
    target_email: body.targetEmail?.trim() || null,
    background_preset: body.design?.backgroundPreset ?? null,
    effect_preset: body.design?.effectPreset ?? null,
    icon_preset: body.design?.iconPreset ?? null,
    animated_icon_enabled: body.design?.animatedIconEnabled ?? false,
    text_color: body.design?.textColor ?? null,
    accent_color: body.design?.accentColor ?? null,
    outline_color: body.design?.outlineColor ?? null,
    recipient_count: inserted,
    created_by: owner.user.id,
  });

  if (auditErr) {
    console.warn("[broadcast] notifications delivered but audit log failed:", auditErr.message);
  }

  if (readableCount === 0 && inserted > 0) {
    return NextResponse.json(
      {
        error: "Notifications inserted but read-back verification found zero rows for sample user.",
        insertedCount: inserted,
        recipientCount: inserted,
        verifySampleUserId: verifyUserId,
        sampleRecipientIds: insertedUserIds.slice(0, 5),
      },
      { status: 422 },
    );
  }

  const ownerReadable = platformOwnerId
    ? await verifyNotificationsReadable(db, platformOwnerId, title)
    : 0;

  return NextResponse.json({
    ok: true,
    recipientCount: inserted,
    insertedCount: inserted,
    verifiedCount: readableCount,
    failedCount: Math.max(0, inserted - readableCount),
    verifySampleUserId: verifyUserId,
    verifyUnreadForSample: readableCount,
    ownerIncluded: userIds.includes(platformOwnerId),
    visibleToOwner: ownerReadable > 0,
    sampleNotificationIds,
    sampleRecipientIds: insertedUserIds.slice(0, 5),
    visibleOnMain,
    visibleOnAll,
    table: "notifications",
    diagnostics: `Inserted ${inserted} / Verified ${readableCount} / Owner visible: ${ownerReadable > 0 ? "yes" : "no"}`,
  });
}
