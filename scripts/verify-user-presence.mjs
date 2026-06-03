#!/usr/bin/env node
/**
 * VODEX P2.2 — user presence verification (static).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(rel, errors) {
  if (!fs.existsSync(path.join(root, rel))) errors.push(`missing ${rel}`);
}

function must(src, needle, label, errors) {
  if (!src.includes(needle)) errors.push(label);
}

function mustNot(src, needle, label, errors) {
  if (src.includes(needle)) errors.push(label);
}

const errors = [];

exists("supabase/migrations/20260729120000_p22_user_presence.sql", errors);
exists("src/lib/presence/user-presence.ts", errors);
exists("src/app/api/user/presence/me/route.ts", errors);
exists("src/app/api/user/presence/heartbeat/route.ts", errors);
exists("src/app/api/user/presence/mode/route.ts", errors);
exists("src/hooks/use-presence-heartbeat.ts", errors);
exists("src/components/presence/presence-dot.tsx", errors);
exists("src/components/settings/presence-settings-section.tsx", errors);

const mig = read("supabase/migrations/20260729120000_p22_user_presence.sql");
must(mig, "presence_mode", "profiles.presence_mode", errors);
must(mig, "user_presence", "user_presence table", errors);
must(mig, "invisible", "invisible mode constraint", errors);

const lib = read("src/lib/presence/user-presence.ts");
must(lib, "getVisiblePresence", "getVisiblePresence", errors);
must(lib, "getVisiblePresenceForUsers", "batch helper", errors);
must(lib, "PRESENCE_ONLINE_THRESHOLD_MS", "2 min threshold", errors);
must(lib, 'mode === "invisible"', "invisible hides online", errors);

const hb = read("src/app/api/user/presence/heartbeat/route.ts");
must(hb, "getUser()", "auth from session", errors);
mustNot(hb, "userId", "no client user id", errors);

const hook = read("src/hooks/use-presence-heartbeat.ts");
must(hook, "document.hidden", "pause hidden tab", errors);
must(hook, "visibilitychange", "visibility handler", errors);

must(read("src/components/layout/user-menu.tsx"), "PresenceAvatar", "top bar presence", errors);
must(read("src/components/providers/app-provider.tsx"), "usePresenceHeartbeat", "heartbeat wired", errors);
must(read("src/app/api/team/route.ts"), "visible_status", "team presence", errors);
must(read("src/app/(app)/settings/team/page.tsx"), "PresenceDot", "team UI dot", errors);
must(read("src/components/layout/quick-collaborator-popover.tsx"), "PresenceDot", "collaborator popover", errors);

if (errors.length) {
  console.error("verify:user-presence FAILED\n");
  errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
}

console.log("verify:user-presence OK");
