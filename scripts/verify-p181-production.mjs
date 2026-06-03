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

const suites = {
  "footer-birds-positioning": () => {
    const errors = [];
    const css = read("src/app/globals.css");
    must(css, "vodex-footer-bird-static--left", "left bird", errors);
    must(css, "clamp(8%, 12vw, 14%)", "birds toward center", errors);
    must(css, "vodex-footer-bird-aura", "bird aura", errors);
    must(css, "vodex-footer-bird-static--desktop-only", "desktop only", errors);
    return errors;
  },
  "mobile-footer-bird-visible": () => {
    const errors = [];
    const css = read("src/app/globals.css");
    must(css, "vodex-footer-bird-static--mobile-only", "mobile bird", errors);
    must(read("src/components/layout/footer-iced-birds.tsx"), "footer-iced-bird-mobile", "mobile testid", errors);
    must(css, "bottom: 24%", "mobile vertical", errors);
    must(css, "right: max", "mobile right", errors);
    return errors;
  },
  "footer-discord-position": () => {
    const errors = [];
    const footer = read("src/components/layout/vodex-important-links-footer.tsx");
    must(footer, "vodex-footer-discord-mobile", "mobile discord top", errors);
    must(footer, "vodex-footer-discord-desktop", "desktop discord billing", errors);
    must(footer, "lg:hidden", "hide mobile block on desktop", errors);
    must(footer, "hidden lg:block", "desktop under billing", errors);
    return errors;
  },
  "credits-used-up-full-width": () => {
    const errors = [];
    const panel = read("src/components/billing/build-credits-upgrade-panel.tsx");
    must(panel, "max-w-none", "full width panel", errors);
    must(panel, "build-credits-upgrade-perks", "perks list", errors);
    must(read("src/lib/billing/build-credits-upgrade.ts"), "and more…", "and more perk", errors);
    return errors;
  },
  "admin-control-center-broadcast-preview": () => {
    const errors = [];
    const panel = read("src/components/admin/admin-control-center-panel.tsx");
    must(panel, "admin-notification-preview", "preview", errors);
    must(panel, "iconKey", "icon option", errors);
    must(panel, "effectKey", "effect option", errors);
    must(panel, "templateId", "template id send", errors);
    must(read("src/app/api/admin/notifications/broadcast/route.ts"), "icon_key", "api icon", errors);
    return errors;
  },
  "platform-banner-max-two": () => {
    const errors = [];
    must(read("src/lib/status/status-public.ts"), ".limit(2)", "max two banners", errors);
    must(read("src/components/admin/admin-system-status-panel.tsx"), "AdminSystemStatusPanel", "banner admin", errors);
    return errors;
  },
  "notifications-bell-unread-count": () => {
    const errors = [];
    must(read("src/components/notifications/notification-panel.tsx"), "notification-unread-badge", "badge testid", errors);
    must(read("src/components/notifications/notification-panel.tsx"), "bg-red-600", "red badge", errors);
    must(read("src/lib/stores/notifications-store.ts"), "unreadCount", "store count", errors);
    return errors;
  },
  "welcome-notification-once": () => {
    const errors = [];
    must(read("src/lib/notifications/welcome-notification.ts"), "Welcome to Vodex", "welcome title", errors);
    must(read("src/app/api/notifications/welcome/route.ts"), "ensureWelcomeNotification", "welcome api", errors);
    must(read("src/app/api/admin/notifications/welcome-backfill/route.ts"), "welcome-backfill", "backfill", errors);
    return errors;
  },
  "logout-modal-polish": () => {
    const errors = [];
    const modal = read("src/components/auth/logout-confirm-modal.tsx");
    must(modal, "logout-confirm-modal", "testid", errors);
    must(modal, "vodex-logout-modal-card", "premium card", errors);
    must(read("src/app/globals.css"), "vodex-logout-modal-card__cta", "gradient cta", errors);
    return errors;
  },
  "status-tables-installed": () => {
    const errors = [];
    for (const f of [
      "supabase/migrations/20260720120000_platform_status.sql",
      "supabase/migrations/20260721120000_platform_status_p16.sql",
      "supabase/migrations/20260722120000_p17_production_stability.sql",
    ]) {
      if (!fs.existsSync(path.join(root, f))) errors.push(`missing ${f}`);
    }
    must(read("src/lib/status/status-db.ts"), "NOTIFY pgrst", "reload hint", errors);
    must(read("src/components/admin/admin-system-status-panel.tsx"), "Status tables not installed", "owner hint", errors);
    return errors;
  },
  "help-center-docs-complete": () => {
    const errors = [];
    const docs = read("src/lib/docs.ts");
    for (const slug of [
      "capacitor-export",
      "web-to-mobile-app",
      "play-store-readiness",
      "app-secrets-integrations",
      "publishing-and-custom-domains",
    ]) {
      must(docs, `slug: "${slug}"`, slug, errors);
    }
    must(docs, "mobile wrapper workflows", "careful mobile claim", errors);
    return errors;
  },
};

const check = process.argv[2] ?? "";
const names = check ? [check] : Object.keys(suites);
let failed = 0;
for (const name of names) {
  const errors = suites[name]?.() ?? [`unknown suite ${name}`];
  console.log(`\n=== verify:${name} ===\n`);
  if (errors.length) {
    failed += 1;
    for (const e of errors) console.log(`✗ ${e}`);
  } else {
    console.log("✓ OK");
  }
}
process.exit(failed ? 1 : 0);
