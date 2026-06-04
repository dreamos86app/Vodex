import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  notificationMatchesTab,
  readNotificationKind,
  type NotificationInboxTab,
} from "@/lib/notifications/notification-kinds";
import type { Notification } from "@/lib/supabase/types";

const TABS: NotificationInboxTab[] = [
  "main",
  "all",
  "workspace",
  "builds",
  "credits",
  "templates",
  "deployments",
  "system",
];

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const notifications = (data ?? []) as Notification[];
  const unreadCount = notifications.filter((n) => !n.read).length;
  const latest = notifications[0] ?? null;

  const tabVisibility = latest
    ? Object.fromEntries(
        TABS.map((tab) => [tab, notificationMatchesTab(latest, tab)]),
      )
    : null;

  const hiddenOnMain =
    latest && !notificationMatchesTab(latest, "main")
      ? {
          kind: readNotificationKind(latest),
          type: latest.type,
          title: latest.title,
          reason:
            readNotificationKind(latest) == null
              ? `type "${latest.type}" is not in Main tab fallback list`
              : `kind "${readNotificationKind(latest)}" is not in MAIN_KINDS`,
        }
      : null;

  return NextResponse.json({
    authUserId: user.id,
    total: notifications.length,
    unreadCount,
    latest10: notifications.slice(0, 10).map((n) => ({
      id: n.id,
      title: n.title,
      type: n.type,
      read: n.read,
      kind: readNotificationKind(n),
      created_at: n.created_at,
      matchesMain: notificationMatchesTab(n, "main"),
      matchesAll: notificationMatchesTab(n, "all"),
    })),
    latestHiddenOnMain: hiddenOnMain,
    tabVisibilityForLatest: tabVisibility,
  });
}
