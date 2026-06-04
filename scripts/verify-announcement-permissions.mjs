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

must(
  "supabase/migrations/20260805120000_p32_announcements_notifications_preview_fix.sql",
  "platform_announcements_public_read",
  "P32 announcements policy",
);
must("src/lib/status/status-schema.ts", "createServiceRoleClient", "admin uses service role");
must("src/lib/status/status-db.ts", "isStatusPermissionDeniedError", "permission denied helper");
must("src/app/api/platform/active-announcements/route.ts", "fetchPublicStatusPayload", "public via server route");

if (errors.length) {
  console.error("verify:announcement-permissions FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:announcement-permissions OK");
