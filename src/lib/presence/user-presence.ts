import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type PresenceMode = "auto" | "online" | "offline" | "invisible";
export type VisiblePresenceStatus = "online" | "offline";

export const PRESENCE_ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

export function normalizePresenceMode(raw: string | null | undefined): PresenceMode {
  if (raw === "online" || raw === "offline" || raw === "invisible") return raw;
  return "auto";
}

export function isUserOnline(lastSeenAt: string | Date | null | undefined, now = Date.now()): boolean {
  if (!lastSeenAt) return false;
  const t = typeof lastSeenAt === "string" ? new Date(lastSeenAt).getTime() : lastSeenAt.getTime();
  if (Number.isNaN(t)) return false;
  return now - t <= PRESENCE_ONLINE_THRESHOLD_MS;
}

export function computeRawStatus(
  lastSeenAt: string | null | undefined,
  now = Date.now(),
): VisiblePresenceStatus {
  return isUserOnline(lastSeenAt, now) ? "online" : "offline";
}

/** What other users should see (never leaks invisible/auto internals). */
export function getVisiblePresence(input: {
  presenceMode: PresenceMode;
  lastSeenAt: string | null | undefined;
  now?: number;
}): VisiblePresenceStatus {
  const mode = normalizePresenceMode(input.presenceMode);
  if (mode === "invisible" || mode === "offline") return "offline";
  if (mode === "online") return "online";
  return computeRawStatus(input.lastSeenAt, input.now);
}

export function presenceLabelForSelf(mode: PresenceMode, visible: VisiblePresenceStatus): string {
  if (mode === "invisible") return "Appearing offline";
  if (visible === "online") return "Online";
  return "Offline";
}

type Writer = SupabaseClient<Database>;

export async function upsertPresenceHeartbeat(
  admin: Writer,
  userId: string,
): Promise<void> {
  const now = new Date().toISOString();
  await admin.from("user_presence").upsert(
    {
      user_id: userId,
      last_seen_at: now,
      current_status: "online",
      updated_at: now,
    } as never,
    { onConflict: "user_id" },
  );
}

export async function getPresenceModeForUser(
  admin: Writer,
  userId: string,
): Promise<PresenceMode> {
  const { data } = await admin
    .from("profiles")
    .select("presence_mode")
    .eq("id", userId)
    .maybeSingle();
  return normalizePresenceMode(data?.presence_mode as string | undefined);
}

export type PresenceRow = {
  userId: string;
  presenceMode: PresenceMode;
  visibleStatus: VisiblePresenceStatus;
};

export async function getVisiblePresenceForUsers(
  admin: Writer,
  userIds: string[],
  now = Date.now(),
): Promise<Record<string, VisiblePresenceStatus>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const out: Record<string, VisiblePresenceStatus> = {};
  if (unique.length === 0) return out;

  const [{ data: profiles }, { data: presence }] = await Promise.all([
    admin.from("profiles").select("id, presence_mode").in("id", unique),
    admin.from("user_presence").select("user_id, last_seen_at").in("user_id", unique),
  ]);

  const modeById = new Map(
    (profiles ?? []).map((p) => [p.id as string, normalizePresenceMode(p.presence_mode as string)]),
  );
  const seenById = new Map(
    (presence ?? []).map((p) => [p.user_id as string, p.last_seen_at as string]),
  );

  for (const id of unique) {
    out[id] = getVisiblePresence({
      presenceMode: modeById.get(id) ?? "auto",
      lastSeenAt: seenById.get(id) ?? null,
      now,
    });
  }

  return out;
}

export async function getOwnPresenceSnapshot(
  admin: Writer,
  userId: string,
): Promise<{
  presenceMode: PresenceMode;
  visibleStatus: VisiblePresenceStatus;
  label: string;
}> {
  const [{ data: profile }, { data: row }] = await Promise.all([
    admin.from("profiles").select("presence_mode").eq("id", userId).maybeSingle(),
    admin.from("user_presence").select("last_seen_at").eq("user_id", userId).maybeSingle(),
  ]);

  const presenceMode = normalizePresenceMode(profile?.presence_mode as string | undefined);
  const visibleStatus = getVisiblePresence({
    presenceMode,
    lastSeenAt: row?.last_seen_at ?? null,
  });

  return {
    presenceMode,
    visibleStatus,
    label: presenceLabelForSelf(presenceMode, visibleStatus),
  };
}
