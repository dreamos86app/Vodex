#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const must = (rel, needle, label) => {
  const src = fs.readFileSync(path.join(root, rel), "utf8");
  if (!src.includes(needle)) errors.push(label);
};

must("src/app/api/notifications/debug/route.ts", "authUserId", "debug route");
must("src/app/api/admin/notifications/broadcast/route.ts", "visibleOnMain", "broadcast main tab verify");
must("src/lib/notifications/notification-kinds.ts", "admin_message", "admin_message in kinds");
must("src/components/providers/app-provider.tsx", "refreshUserNotificationsFromApi", "API refresh bootstrap");

if (errors.length) {
  console.error("verify:notification-read-path FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:notification-read-path OK");
