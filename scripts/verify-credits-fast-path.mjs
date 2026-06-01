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

must("src/app/api/credits/route.ts", "loadCanonicalCreditsLite", "lite loader");
must("src/app/api/credits/route.ts", 'searchParams.get("lite")', "lite query param");
must("src/app/api/credits/route.ts", "credits_lite_ms", "lite timing log");
must("src/lib/stores/credits-store.ts", "applyProfileSeed", "profile seed");
must("src/lib/stores/credits-store.ts", "/api/credits?lite=1", "lite fetch");
must("src/lib/credits/seed-credits-from-profile.ts", "applyProfileSeed", "seed uses profile");
must("src/hooks/use-credits-sync.ts", "bootstrap", "bootstrap sync");
must("src/components/credits/credits-tracker.tsx", "credits-syncing-badge", "syncing badge");

console.log("\n=== verify:credits-fast-path ===\n");
ok.forEach((m) => console.log("✓", m));
errors.forEach((m) => console.error("✗", m));
process.exit(errors.length ? 1 : 0);
