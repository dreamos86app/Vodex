import "server-only";

import type { User } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { recordPublishedAnalyticsEvents } from "@/lib/publish/published-analytics-server";

export type SyncAppUserInput = {
  projectId: string;
  ownerId: string;
  publishedAppId: string;
  slug: string;
  user: User;
  provider?: string | null;
  eventType: "signup_success" | "login_success";
};

export async function syncAppUserProfile(
  input: SyncAppUserInput,
): Promise<{ ok: boolean; error?: string }> {
  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, error: "service_role_unavailable" };

  const now = new Date().toISOString();
  const email = input.user.email ?? null;
  const displayName =
    (input.user.user_metadata?.full_name as string | undefined) ??
    (input.user.user_metadata?.name as string | undefined) ??
    email;
  const avatar =
    (input.user.user_metadata?.avatar_url as string | undefined) ??
    (input.user.user_metadata?.picture as string | undefined) ??
    null;
  const provider =
    input.provider ??
    (input.user.app_metadata?.provider as string | undefined) ??
    (input.user.identities?.[0]?.provider as string | undefined) ??
    "email";

  const { data: existing } = await admin
    .from("app_user_profiles" as never)
    .select("id, first_seen_at, created_at")
    .eq("project_id", input.projectId)
    .eq("auth_user_id", input.user.id)
    .maybeSingle();

  const isNew = !existing;
  const firstSeen =
    (existing as { first_seen_at?: string; created_at?: string } | null)?.first_seen_at ??
    (existing as { created_at?: string } | null)?.created_at ??
    now;

  const row = {
    project_id: input.projectId,
    owner_id: input.ownerId,
    published_app_id: input.publishedAppId,
    auth_user_id: input.user.id,
    email,
    display_name: displayName,
    avatar_url: avatar,
    auth_provider: provider,
    first_seen_at: firstSeen,
    last_seen_at: now,
    meta: {
      last_sync: now,
      providers: input.user.identities?.map((i) => i.provider) ?? [],
    },
  };

  const { error } = await admin.from("app_user_profiles" as never).upsert(row as never, {
    onConflict: "project_id,auth_user_id",
    ignoreDuplicates: false,
  });

  if (error) {
    console.error("[app-user-profile-sync] upsert failed", error.message);
    if (existing) {
      const { error: updateErr } = await admin
        .from("app_user_profiles" as never)
        .update({
          email,
          display_name: displayName,
          avatar_url: avatar,
          auth_provider: provider,
          last_seen_at: now,
          published_app_id: input.publishedAppId,
        } as never)
        .eq("id", (existing as { id: string }).id);
      if (updateErr) {
        console.error("[app-user-profile-sync] fallback update failed", updateErr.message);
        return { ok: false, error: updateErr.message };
      }
    } else {
      const { error: insertErr } = await admin.from("app_user_profiles" as never).insert(row as never);
      if (insertErr) {
        console.error("[app-user-profile-sync] fallback insert failed", insertErr.message);
        return { ok: false, error: insertErr.message };
      }
    }
  }

  const analyticsOk = await recordPublishedAnalyticsEvents({
    slug: input.slug,
    projectId: input.projectId,
    ownerId: input.ownerId,
    publishedAppId: input.publishedAppId,
    events: [
      {
        event_type: input.eventType,
        meta: { provider, auth_user_id: input.user.id, is_new: isNew },
      },
    ],
  });

  if (!analyticsOk) {
    console.error("[app-user-profile-sync] analytics write failed");
  }

  return { ok: true };
}
