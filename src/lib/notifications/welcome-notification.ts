import type { SupabaseClient } from "@supabase/supabase-js";

const WELCOME_TITLE_PREFIX = "Welcome to Vodex";

export async function ensureWelcomeNotification(
  admin: SupabaseClient,
  userId: string,
  displayName?: string | null,
): Promise<boolean> {
  const { data: existing } = await admin
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "system")
    .ilike("title", `${WELCOME_TITLE_PREFIX}%`)
    .limit(1)
    .maybeSingle();

  if (existing?.id) return false;

  const firstName = (displayName ?? "").trim().split(/\s+/)[0];
  const title = firstName
    ? `${WELCOME_TITLE_PREFIX}, ${firstName}!`
    : `${WELCOME_TITLE_PREFIX}!`;

  const { error } = await admin.from("notifications").insert({
    user_id: userId,
    type: "system",
    title,
    body: "Welcome to Vodex — we added free credits so you can start building your first app.",
    read: false,
    action_url: "/",
    metadata: {
      kind: "welcome",
      premium: true,
      free_credits: true,
      icon_key: "sparkles",
      effect_key: "stars",
      play_sound: true,
    },
  } as never);

  return !error;
}
