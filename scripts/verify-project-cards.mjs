#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = false;

function mustInclude(file, needle, label) {
  const p = path.join(root, file);
  if (!fs.existsSync(p)) {
    console.error("✗ missing", file);
    failed = true;
    return;
  }
  if (!fs.readFileSync(p, "utf8").includes(needle)) {
    console.error(`✗ ${label}`);
    failed = true;
  } else console.log(`✓ ${label}`);
}

mustInclude("src/components/projects/project-icon.tsx", "object-cover", "icon fills circle");
mustInclude("src/components/projects/project-icon.tsx", "rounded-full", "circular icon");
mustInclude("src/components/projects/project-banner.tsx", "previewOnly", "preview-only card mode");
mustInclude("src/components/apps/projects-view.tsx", "ProjectBanner", "projects view banner");
mustInclude("src/components/os-home/your-apps-section.tsx", "ProjectBanner", "home cards banner");
mustInclude("src/components/os-home/your-apps-section.tsx", "data-testid=\"your-apps-section\"", "home apps section");

process.exit(failed ? 1 : 0);
