#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = false;

function mustExist(rel) {
  if (!fs.existsSync(path.join(root, rel))) {
    console.error("✗ missing", rel);
    failed = true;
  } else console.log("✓", rel);
}

function mustInclude(file, needle, label) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  if (!text.includes(needle)) {
    console.error(`✗ ${label}`);
    failed = true;
  } else console.log(`✓ ${label}`);
}

[
  "src/lib/projects/ensure-project-icon.ts",
  "src/lib/projects/build-initials-icon-svg.ts",
  "src/lib/projects/backfill-project-media.ts",
  "src/components/projects/project-icon.tsx",
].forEach(mustExist);

mustInclude("src/lib/projects/ensure-project-icon.ts", "isWeakIconSvg", "weak icon detection");
mustInclude("src/lib/projects/ensure-project-icon.ts", "ensureProjectIconSvg", "ensure icon helper");
mustInclude("src/app/api/projects/route.ts", "backfillProjectMediaIfNeeded", "list API backfill");
mustInclude("src/app/api/projects/import-zip/route.ts", "ensureProjectIconSvg", "import ensures icon");
mustInclude("src/components/os-home/your-apps-section.tsx", "ProjectIcon", "home cards use ProjectIcon");
mustInclude("src/components/apps/projects-view.tsx", "ProjectIcon", "projects grid uses ProjectIcon");

process.exit(failed ? 1 : 0);
