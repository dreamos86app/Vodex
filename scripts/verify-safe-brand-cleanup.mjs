/**
 * Report DreamOS86 / dreamos references grouped by risk.
 * Run: npm run verify:safe-brand-cleanup
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const USER_FACING_PATTERNS = [
  /DreamOS86/i,
  /dreamos86\.com/i,
  /dreamos86app@gmail\.com/i,
];
const INTERNAL_PATTERNS = [/dreamos-/i];

const ALLOW_PREFIX = [
  "supabase/migrations/",
  "scripts/dreamos-",
  "scripts/full-runtime",
  "scripts/runtime-repair",
  "node_modules/",
  ".next/",
];

const ALLOW_FILE = [
  "legacy-brand-allowlist.ts",
  "legacy-redirect.ts",
  "github-oauth-checklist.ts",
  "brand-config.ts",
  "verify-brand-migration.mjs",
  "verify-safe-brand-cleanup.mjs",
  "dreamos-identity.ts",
  "dreamos-logger.ts",
  "dreamos-message-shell.tsx",
  "dreamos-billing-provider.ts",
];

async function walk(dir, files = []) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const ent of entries) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".next") continue;
      await walk(p, files);
    } else {
      files.push(p);
    }
  }
  return files;
}

function bucket(rel) {
  if (ALLOW_PREFIX.some((p) => rel.startsWith(p))) return "migrations/history";
  if (ALLOW_FILE.some((f) => rel.includes(f))) return "internal-allowlist";
  if (rel.startsWith("public/brand/dreamos")) return "unused-assets";
  if (rel.startsWith("src/") || rel.startsWith("public/")) return "user-facing-active";
  if (rel.startsWith("docs/")) return "docs";
  return "other";
}

async function main() {
  const groups = {
    "user-facing-active": [],
    "internal-allowlist": [],
    "migrations/history": [],
    "unused-assets": [],
    docs: [],
    other: [],
  };

  const files = await walk(ROOT);
  for (const file of files) {
    const rel = path.relative(ROOT, file).replace(/\\/g, "/");
    if (!/\.(tsx?|jsx?|mjs|json|md|sql|png|svg|webmanifest|css)$/.test(rel)) continue;
    if (ALLOW_FILE.some((f) => rel.endsWith(f) || rel.includes(`/${f}`))) {
      groups["internal-allowlist"].push(rel);
      continue;
    }
    const text = await fs.readFile(file, "utf8").catch(() => "");
    const isUserFacing = rel.startsWith("src/") || rel.startsWith("public/");
    const patterns = isUserFacing ? USER_FACING_PATTERNS : [...USER_FACING_PATTERNS, ...INTERNAL_PATTERNS];
    if (!patterns.some((re) => re.test(text))) continue;
    const b = bucket(rel);
    if (b === "user-facing-active" && !USER_FACING_PATTERNS.some((re) => re.test(text))) {
      continue;
    }
    if (!groups[b].includes(rel)) groups[b].push(rel);
  }

  console.log("verify:safe-brand-cleanup report\n");
  for (const [key, list] of Object.entries(groups)) {
    console.log(`## ${key} (${list.length})`);
    list.slice(0, 12).forEach((f) => console.log(`  - ${f}`));
    if (list.length > 12) console.log(`  … +${list.length - 12} more`);
    console.log("");
  }

  if (groups["user-facing-active"].length > 0) {
    console.error(
      "FAIL: user-facing-active code still references DreamOS86/dreamos — fix or allowlist\n",
    );
    process.exit(1);
  }

  console.log("verify:safe-brand-cleanup OK (no user-facing active references)");
}

main();
