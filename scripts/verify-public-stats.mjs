#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = false;

function mustInclude(file, needle, label) {
  const p = path.join(root, file);
  if (!fs.readFileSync(p, "utf8").includes(needle)) {
    console.error(`✗ ${label}`);
    failed = true;
  } else console.log(`✓ ${label}`);
}

if (!fs.existsSync(path.join(root, "src/app/api/public/stats/route.ts"))) {
  console.error("✗ missing public stats API");
  failed = true;
} else console.log("✓ public stats API");

mustInclude("src/components/os-home/dreamos-stats-section.tsx", "StatSkeleton", "stats loading skeleton");
mustInclude("src/components/os-home/dreamos-stats-section.tsx", "/api/public/stats", "stats fetch");
mustInclude("src/lib/public/platform-showcase-stats.ts", "50_000", "showcase stats floors");
mustInclude("src/app/api/public/stats/route.ts", "mergeWithShowcaseStats", "API merges showcase floors");
mustInclude("src/components/os-home/dreamos-stats-section.tsx", "showcaseStatsFallback", "client stats fallback");

const stats = fs.readFileSync(path.join(root, "src/components/os-home/dreamos-stats-section.tsx"), "utf8");
if (stats.includes("50_000") && stats.includes("1_000_000")) {
  console.error("✗ hardcoded stats in component — use platform-showcase-stats");
  failed = true;
} else console.log("✓ stats not hardcoded in component");

process.exit(failed ? 1 : 0);
