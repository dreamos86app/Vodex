#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const must = (rel, needle, label) => {
  if (!fs.readFileSync(path.join(root, rel), "utf8").includes(needle)) errors.push(label);
};

must("src/components/platform/platform-announcement-banners.tsx", "platform-incident-banner", "banner component");
must("src/components/platform/platform-announcement-banners.tsx", "active-announcements", "banner fetches announcements");
must("src/components/admin/admin-announcements-panel.tsx", "toggleAnnouncement", "admin toggle");
must("src/components/admin/admin-announcements-panel.tsx", "a.is_active", "inactive hidden from list");

if (errors.length) {
  console.error("verify:announcements FAILED\n", errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
console.log("verify:announcements OK");
