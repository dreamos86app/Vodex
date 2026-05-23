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
  const text = fs.readFileSync(p, "utf8");
  if (!text.includes(needle)) {
    console.error(`✗ ${label}`);
    failed = true;
  } else console.log(`✓ ${label}`);
}

mustInclude("src/lib/projects/build-project-banner-svg.ts", "buildProjectBannerSvg", "banner builder");
mustInclude("src/app/api/projects/[id]/banner/route.ts", "buildBannerForProject", "banner API route");
mustInclude("src/lib/projects/backfill-project-media.ts", "banner_svg", "banner backfill metadata");
mustInclude("src/app/api/projects/import-zip/route.ts", "banner_svg", "import sets banner");
mustInclude("src/components/projects/project-banner.tsx", "ProjectBanner", "shared banner component");

process.exit(failed ? 1 : 0);
