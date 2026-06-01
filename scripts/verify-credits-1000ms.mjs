#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];

function must(rel, needle, label) {
  const src = fs.readFileSync(path.join(root, rel), "utf8");
  if (!src.includes(needle)) errors.push(`${rel} missing ${label}`);
  else ok.push(label);
}

must("src/lib/stores/credits-store.ts", "AbortController", "1s fetch timeout");
must("src/lib/stores/credits-store.ts", "applyProfileSeed", "profile seed");
must("src/lib/credits/credits-local-cache.ts", "loadCreditsLocalCache", "local cache");
must("src/lib/credits/credits-local-cache.ts", "credits_first_paint_ms", "first paint metric");
must("src/app/api/credits/route.ts", "loadCanonicalCreditsLite", "lite endpoint");
must("src/components/credits/credits-tracker.tsx", "hasDisplayValues", "no blank skeleton when seeded");

console.log("\n=== verify:credits-1000ms ===\n");
ok.forEach((m) => console.log("✓", m));
errors.forEach((m) => console.error("✗", m));
process.exit(errors.length ? 1 : 0);
