/**
 * Vodex — Notifications Store
 * Real-time notification state via Supabase Realtime.
 */
import { create } from "zustand";
import { readNotificationKind } from "@/lib/notifications/notification-kinds";
import type { Notification } from "@/lib/supabase/types";

function dedupeNotifications(notifications: Notification[]): Notification[] {
  const byId = new Map<string, Notification>();
  for (const n of notifications) {
    if (!byId.has(n.id)) byId.set(n.id, n);
  }
  let list = [...byId.values()];
  const welcomes = list.filter(
    (n) =>
      readNotificationKind(n) === "welcome" ||
      (typeof n.title === "string" && n.title.startsWith("Welcome to Vodex")),
  );
  if (welcomes.length > 1) {
    welcomes.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    const keepId = welcomes[0]!.id;
    list = list.filter((n) => {
      const isWelcome =
        readNotificationKind(n) === "welcome" ||
        (typeof n.title === "string" && n.title.startsWith("Welcome to Vodex"));
      return !isWelcome || n.id === keepId;
    });
  }
  return list.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;

  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useNotificationsStore = create<NotificationsState>()((set) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,

  setNotifications: (notifications) => {
    const next = dedupeNotifications(notifications);
    set({
      notifications: next,
      unreadCount: next.filter((n) => !n.read).length,
    });
  },

  addNotification: (notification) =>
    set((s) => {
      if (s.notifications.some((n) => n.id === notification.id)) return s;
      const next = [notification, ...s.notifications];
      return {
        notifications: next,
        unreadCount: next.filter((n) => !n.read).length,
      };
    }),

  markRead: (id) => {
    set((s) => {
      const updated = s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      );
      return {
        notifications: updated,
        unreadCount: updated.filter((n) => !n.read).length,
      };
    });
    void fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id }),
    }).catch(() => undefined);
  },

  markAllRead: () => {
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
    void fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ all: true }),
    }).catch(() => undefined);
  },

  setLoading: (loading) => set({ loading }),

  reset: () => set({ notifications: [], unreadCount: 0, loading: false }),
}));
