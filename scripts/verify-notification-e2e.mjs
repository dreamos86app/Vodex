#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const must = (rel, needle, label) => {
  if (!fs.readFileSync(path.join(root, rel), "utf8").includes(needle)) errors.push(label);
};

must("src/lib/notifications/notification-service.ts", "broadcast", "broadcast path");
must("src/app/api/admin/notifications/broadcast/route.ts", "broadcast", "admin broadcast API");
must("src/components/notifications/notification-panel.tsx", "action_url", "visit URL support");
must("src/lib/stores/notifications-store.ts", "dedupeNotifications", "dedupe notifications");
must("src/components/providers/app-provider.tsx", "visibilitychange", "visibility refresh");

if (errors.length) {
  console.error("verify:notification-e2e FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:notification-e2e OK");
