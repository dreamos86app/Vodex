#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = false;

function mustInclude(file, needle, label) {
  if (!fs.readFileSync(path.join(root, file), "utf8").includes(needle)) {
    console.error(`✗ ${label}`);
    failed = true;
  } else console.log(`✓ ${label}`);
}

mustInclude("src/app/(app)/page.tsx", "dynamic(", "home OsHome lazy loaded");
mustInclude("src/app/(app)/page.tsx", "ensureProjectIconSvg", "home ensures icons locally");
mustInclude("src/components/os-home/os-home.tsx", "YourAppsSection", "home your apps");
mustInclude("src/components/os-home/dreamos-stats-section.tsx", "dreamos-stats-section", "stats section test id");

process.exit(failed ? 1 : 0);
