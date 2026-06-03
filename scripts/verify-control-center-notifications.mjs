#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function must(src, needle, label, errors) {
  if (!src.includes(needle)) errors.push(label);
}

const errors = [];

must(read("src/components/admin/admin-control-center-panel.tsx"), "AdminInboxMessagesPanel", "inbox tab", errors);
must(read("src/components/admin/admin-control-center-panel.tsx"), "AdminAnnouncementsPanel", "announcements tab", errors);
must(read("src/components/admin/admin-control-center-panel.tsx"), "AdminEmailMarketingPanel", "email tab", errors);
if (read("src/components/admin/admin-control-center-panel.tsx").includes("welcome-backfill")) {
  errors.push("no welcome backfill in control center");
}
must(read("src/components/notifications/notification-panel.tsx"), "No notifications yet", "empty state", errors);
must(read("src/components/notifications/notification-panel.tsx"), "notification-inbox-tabs", "inbox tabs", errors);
must(read("src/lib/notifications/inbox-message-templates.ts"), "Welcome to Vodex", "8 inbox templates", errors);
must(read("src/lib/status/announcement-templates.ts"), "service_restored", "8 announcement templates", errors);
must(read("src/lib/email/marketing-email-templates.ts"), "MARKETING_EMAIL_TEMPLATES", "email templates", errors);
must(read("src/app/(app)/settings/notifications/page.tsx"), "In-app notification sounds", "sounds only settings", errors);
must(read("src/app/globals.css"), "--mobile-bottom-nav-height", "mobile nav height var", errors);
must(read("src/app/globals.css"), "vodex-footer-columns", "footer column padding", errors);
must(read("src/lib/notifications/create-user-notification.ts"), "createUserNotification", "typed notifications", errors);
must(read("src/lib/team/workspace-invitations.ts"), "workspace_invite_received", "invite notification", errors);

for (const f of [
  "supabase/migrations/20260720120000_platform_status.sql",
  "supabase/migrations/20260721120000_platform_status_p16.sql",
  "supabase/migrations/20260722120000_p17_production_stability.sql",
  "supabase/migrations/20260728120000_p21_control_center_comms.sql",
]) {
  if (!fs.existsSync(path.join(root, f))) errors.push(`missing ${f}`);
}

console.log(errors.length ? errors.map((e) => `✗ ${e}`).join("\n") : "✓ verify:control-center-notifications OK");
process.exit(errors.length ? 1 : 0);
