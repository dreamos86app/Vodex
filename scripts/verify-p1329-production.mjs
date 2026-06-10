#!/usr/bin/env node
/**
 * P1.3.29 production verification gates.
 * Usage: npm run verify:p1329-production [check-name]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const checks = {
  "preview-no-platform-path-leak": () => {
    const strip = read("src/lib/preview/strip-preview-platform-paths.ts");
    const shim = read("src/lib/preview/inject-preview-virtual-history.ts");
    assert(strip.includes("api/projects"), "strip missing api/projects patterns");
    assert(strip.includes("vodex\\.dev"), "strip missing vodex.dev rewrite");
    assert(shim.includes("serviceWorker"), "shim must block service workers");
    assert(shim.includes("__next_f"), "shim must patch __next_f");
  },
  "rebuild-preview-artifact-schema": () => {
    const script = read("scripts/rebuild-preview-artifact.ts");
    assert(script.includes("runProjectPreviewBuild"), "rebuild must use canonical queue");
    assert(script.includes("owner_id"), "rebuild must load owner_id");
    assert(!script.includes('priority: 10'), "rebuild must not manual-insert priority");
  },
  "ai-chat-no-raw-error": () => {
    const pe = read("src/lib/ai/provider-errors.ts");
    const cv = read("src/components/chat/chat-view.tsx");
    assert(!pe.includes("Something went wrong while generating"), "generic provider error remains");
    assert(cv.includes("couldn't finish that response"), "chat view friendly error missing");
  },
  "ai-chat-no-page-refresh": () => {
    const cv = read("src/components/chat/chat-view.tsx");
    assert(cv.includes("history.replaceState"), "chat must use history.replaceState");
    assert(cv.includes("submitInFlightRef.current) return"), "URL sync must guard during send");
  },
  "credits-one-decimal": () => {
    const cs = read("src/lib/credits/credit-summary.ts");
    assert(cs.includes("minimumFractionDigits: 1"), "credits must use 1 decimal");
    const cv = read("src/components/chat/chat-view.tsx");
    assert(cv.includes("DISCUSS_FLAT_CREDITS"), "chat must deduct discuss flat credits");
  },
  "public-builder-profile": () => {
    const api = read("src/app/api/community/profiles/[username]/route.ts");
    const view = read("src/components/community/public-builder-profile-view.tsx");
    assert(api.includes("public_profile_enabled"), "profile API privacy gate");
    assert(view.includes("PublicBuilderProfileView"), "profile view exists");
    assert(fs.existsSync(path.join(root, "src/app/(app)/builders/[username]/page.tsx")), "builders route missing");
  },
  "discussion-social-ui": () => {
    const cv = read("src/components/community/community-view.tsx");
    const dd = read("src/components/community/discussion-detail-drawer.tsx");
    assert(cv.includes("md:grid-cols-2"), "discussions 2-col grid");
    assert(dd.includes("handleCommentEdit"), "comment edit handler");
    assert(dd.includes("FlatReply"), "flat reply layout");
  },
  "group-chat-polish": () => {
    const gc = read("src/components/community/group-chat-panel.tsx");
    assert(gc.includes("unreadCount"), "unread pill");
    assert(gc.includes("isNearBottom"), "smart scroll");
    assert(gc.includes("@"), "mention highlight");
  },
  "group-owner-moderation": () => {
    assert(fs.existsSync(path.join(root, "src/app/api/community/groups/[id]/members/[userId]/route.ts")), "kick route");
    assert(fs.existsSync(path.join(root, "src/app/api/community/groups/[id]/sanctions/route.ts")), "sanctions route");
    const gp = read("src/components/community/group-page.tsx");
    assert(gp.includes("kickMember"), "kick UI");
  },
  "reaction-popup": () => {
    const gc = read("src/components/community/group-chat-panel.tsx");
    assert(gc.includes("reactionViewer"), "reaction viewer");
    assert(gc.includes("reactorNames"), "reactor list");
  },
  "sidebar-title-polish": () => {
    const tb = read("src/components/layout/top-bar.tsx");
    assert(tb.includes("sidebarCollapsed") || tb.includes("sidebarOpen"), "top bar sidebar-aware title");
  },
};

const only = process.argv[2];
const names = only ? [only] : Object.keys(checks);
for (const name of names) {
  const fn = checks[name];
  if (!fn) {
    console.error(`Unknown check: ${name}`);
    process.exit(1);
  }
  fn();
  console.log(`verify:p1329-production ${name} OK`);
}
