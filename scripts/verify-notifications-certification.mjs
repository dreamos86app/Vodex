#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const must = (rel, needle, label) => {
  const p = path.join(root, rel);
  if (!fs.existsSync(p) || !fs.readFileSync(p, "utf8").includes(needle)) errors.push(label);
};

must("src/lib/notifications/notification-service.ts", "broadcast", "broadcast");
must("src/lib/stores/notifications-store.ts", "dedupe", "dedupe");
must("src/lib/stores/notifications-store.ts", "unread", "unread counts");
must("src/components/providers/app-provider.tsx", "visibilitychange", "visibility refresh");
must("src/components/notifications/notification-panel.tsx", "action_url", "action URLs");
must("src/app/api/admin/notifications/broadcast/route.ts", "broadcast", "admin broadcast API");
must("scripts/verify-notification-e2e.mjs", "notification-e2e", "baseline notification verify");

if (errors.length) {
  console.error("verify:notifications-certification FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:notifications-certification OK");
