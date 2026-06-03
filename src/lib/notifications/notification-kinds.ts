import type { Notification } from "@/lib/supabase/types";

/** Fine-grained inbox kinds stored in notifications.metadata.kind */
export type NotificationKind =
  | "welcome"
  | "admin_message"
  | "workspace_invite_received"
  | "workspace_invite_accepted"
  | "workspace_member_joined"
  | "workspace_member_removed"
  | "collaborator_invited"
  | "collaborator_accepted"
  | "build_started"
  | "build_completed"
  | "build_failed"
  | "credits_low"
  | "credits_added"
  | "subscription_updated"
  | "template_liked"
  | "template_used"
  | "template_published"
  | "app_published"
  | "deployment_started"
  | "deployment_completed"
  | "deployment_failed"
  | "security_alert"
  | "integration_connected"
  | "integration_failed"
  | "system_status";

export type NotificationInboxTab =
  | "main"
  | "all"
  | "workspace"
  | "builds"
  | "credits"
  | "templates"
  | "deployments"
  | "system";

export const INBOX_TABS: { id: NotificationInboxTab; label: string }[] = [
  { id: "main", label: "Main" },
  { id: "all", label: "All" },
  { id: "workspace", label: "Workspace" },
  { id: "builds", label: "Builds" },
  { id: "credits", label: "Credits" },
  { id: "templates", label: "Templates" },
  { id: "deployments", label: "Deployments" },
  { id: "system", label: "System" },
];

const MAIN_KINDS = new Set<NotificationKind>([
  "welcome",
  "admin_message",
  "workspace_invite_received",
  "workspace_invite_accepted",
  "collaborator_invited",
  "collaborator_accepted",
  "security_alert",
  "system_status",
  "credits_low",
  "credits_added",
  "subscription_updated",
]);

const TAB_KINDS: Record<Exclude<NotificationInboxTab, "main" | "all">, Set<NotificationKind>> = {
  workspace: new Set([
    "workspace_invite_received",
    "workspace_invite_accepted",
    "workspace_member_joined",
    "workspace_member_removed",
    "collaborator_invited",
    "collaborator_accepted",
  ]),
  builds: new Set(["build_started", "build_completed", "build_failed"]),
  credits: new Set(["credits_low", "credits_added", "subscription_updated"]),
  templates: new Set(["template_liked", "template_used", "template_published"]),
  deployments: new Set([
    "deployment_started",
    "deployment_completed",
    "deployment_failed",
    "app_published",
  ]),
  system: new Set([
    "admin_message",
    "security_alert",
    "system_status",
    "integration_connected",
    "integration_failed",
    "welcome",
  ]),
};

export function readNotificationKind(n: Notification): NotificationKind | null {
  const md = n.metadata as Record<string, unknown> | null;
  if (typeof md?.kind === "string") return md.kind as NotificationKind;
  if (n.type === "invite") return "workspace_invite_received";
  if (n.type === "build") return "build_completed";
  if (n.type === "deploy") return "deployment_completed";
  if (n.type === "credit") return "credits_added";
  if (typeof n.title === "string" && n.title.startsWith("Welcome to Vodex")) return "welcome";
  return null;
}

export function notificationMatchesTab(n: Notification, tab: NotificationInboxTab): boolean {
  const kind = readNotificationKind(n);
  if (tab === "all") return true;
  if (tab === "main") {
    if (kind) return MAIN_KINDS.has(kind);
    return n.type === "invite" || n.type === "credit" || n.type === "system";
  }
  if (!kind) {
    if (tab === "workspace") return n.type === "invite";
    if (tab === "builds") return n.type === "build";
    if (tab === "credits") return n.type === "credit";
    if (tab === "deployments") return n.type === "deploy";
    if (tab === "system") return n.type === "system" || n.type === "ai";
    return false;
  }
  return TAB_KINDS[tab].has(kind);
}

export function legacyTypeForKind(kind: NotificationKind): Notification["type"] {
  if (kind.startsWith("build_")) return "build";
  if (kind.startsWith("deployment_") || kind === "app_published") return "deploy";
  if (kind.startsWith("workspace_") || kind.startsWith("collaborator_")) return "invite";
  if (kind.startsWith("credit") || kind === "subscription_updated") return "credit";
  if (kind.startsWith("template_")) return "ai";
  return "system";
}
