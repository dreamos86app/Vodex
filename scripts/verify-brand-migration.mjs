/**
 * Fail CI/dev if forbidden DreamOS86 strings appear in user-facing paths.
 * Run: npm run verify:brand-migration
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const SCAN_DIRS = [
  "src/app",
  "src/components",
  "src/lib",
  "public",
  ".env.example",
].map((p) => path.join(ROOT, p));

const FORBIDDEN = [
  /DreamOS86/i,
  /DREAMOS86/,
  /dreamos86\.com/i,
  /dreamos86app@gmail\.com/i,
  /Dreamos86app/i,
  /dreamos86app(?!\.vercel)/i,
];

const ALLOW_FILE_SUFFIX = [
  "legacy-brand-allowlist.ts",
  "brand-config.ts",
  "verify-brand-migration.mjs",
  "migrate-brand-strings.mjs",
];

const ALLOW_LINE = [
  /@legacy-migration/,
  /LEGACY_/,
  /OLD_BRAND_NAMES/,
  /OLD_DOMAINS/,
  /legacy-brand-allowlist/,
  /Re-export/,
];

async function walk(filePath, files = []) {
  const st = await fs.stat(filePath);
  if (st.isFile()) {
    files.push(filePath);
    return files;
  }
  for (const ent of await fs.readdir(filePath, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === ".next") continue;
    await walk(path.join(filePath, ent.name), files);
  }
  return files;
}

function isAllowedFile(file) {
  const base = path.basename(file);
  return ALLOW_FILE_SUFFIX.some((s) => base.endsWith(s) || base === s);
}

function lineAllowed(line) {
  return ALLOW_LINE.some((re) => re.test(line));
}

async function main() {
  const hits = [];

  for (const dir of SCAN_DIRS) {
    let files;
    try {
      files = await walk(dir);
    } catch {
      continue;
    }
    for (const file of files) {
      if (!/\.(tsx?|jsx?|mjs|json|webmanifest|svg|md|example|txt|html)$/i.test(file)) continue;
      if (isAllowedFile(file)) continue;
      const rel = path.relative(ROOT, file).replace(/\\/g, "/");
      const text = await fs.readFile(file, "utf8");
      const lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (lineAllowed(line)) continue;
        for (const re of FORBIDDEN) {
          if (re.test(line)) {
            hits.push({ rel, line: i + 1, snippet: line.trim().slice(0, 120) });
            break;
          }
        }
      }
    }
  }

  if (hits.length) {
    console.error("[verify-brand-migration] FAILED — forbidden legacy brand strings:\n");
    for (const h of hits.slice(0, 80)) {
      console.error(`  ${h.rel}:${h.line}  ${h.snippet}`);
    }
    if (hits.length > 80) console.error(`  … and ${hits.length - 80} more`);
    process.exit(1);
  }

  console.log("[verify-brand-migration] OK — no forbidden strings in scanned paths");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
