import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  legacyTypeForKind,
  type NotificationKind,
} from "@/lib/notifications/notification-kinds";

type Writer = SupabaseClient<Database>;

export type CreateUserNotificationInput = {
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  actionUrl?: string | null;
  iconKey?: string;
  effectKey?: string;
  playSound?: boolean;
  metadata?: Record<string, unknown>;
};

/** Server-only: insert a typed inbox notification for one user. */
export async function createUserNotification(
  admin: Writer,
  input: CreateUserNotificationInput,
): Promise<{ ok: boolean; error?: string }> {
  const type = legacyTypeForKind(input.kind);
  const { error } = await admin.from("notifications").insert({
    user_id: input.userId,
    type,
    title: input.title,
    body: input.body,
    read: false,
    action_url: input.actionUrl ?? null,
    metadata: {
      kind: input.kind,
      icon_key: input.iconKey ?? "bell",
      effect_key: input.effectKey ?? "glow",
      play_sound: input.playSound !== false,
      ...input.metadata,
    },
  } as never);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
