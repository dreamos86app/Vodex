import type { Notification } from "@/lib/supabase/types";
import { useNotificationsStore } from "@/lib/stores/notifications-store";
import { getCachedNotificationPrefs } from "@/lib/notifications/notification-prefs-cache";
import { shouldPlayInWebSound } from "@/lib/notifications/notification-preferences";
import { resolveInWebSoundKey } from "@/lib/notifications/in-web-sound-keys";
import { playNotificationChime } from "@/lib/notifications/notification-sound";

let lastPollChimeAt = 0;

function maybePlayChimeForNewRows(prevIds: Set<string>, rows: Notification[]): void {
  const prefs = getCachedNotificationPrefs();
  const freshUnread = rows.filter((n) => !n.read && !prevIds.has(n.id));
  if (freshUnread.length === 0) return;
  if (Date.now() - lastPollChimeAt < 2000) return;

  for (const row of freshUnread) {
    const md = row.metadata as Record<string, unknown> | null;
    if (md?.play_sound === false) continue;
    const soundKey = resolveInWebSoundKey(row);
    if (shouldPlayInWebSound(prefs, soundKey)) {
      lastPollChimeAt = Date.now();
      playNotificationChime();
      break;
    }
  }
}

/** Pull latest notifications from API (fallback when Realtime insert is missed). */
export async function refreshUserNotificationsFromApi(options?: {
  playSoundOnNew?: boolean;
}): Promise<void> {
  try {
    const prevIds = new Set(
      useNotificationsStore.getState().notifications.map((n) => n.id),
    );
    const res = await fetch("/api/notifications", {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return;
    const json = (await res.json()) as { notifications?: Notification[] };
    if (!json.notifications) return;

    useNotificationsStore.getState().setNotifications(json.notifications);

    if (options?.playSoundOnNew) {
      maybePlayChimeForNewRows(prevIds, json.notifications);
    }
  } catch {
    /* ignore */
  }
}
