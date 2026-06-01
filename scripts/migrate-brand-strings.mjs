/**
 * One-off helper: replace legacy DreamOS86 user-facing strings in src/.
 * Run: node scripts/migrate-brand-strings.mjs
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");

const SKIP = new Set([path.normalize("src/lib/brand/legacy-brand-allowlist.ts")]);

const REPLACEMENTS = [
  [/https:\/\/dreamos86\.com/g, "https://vodex.dev"],
  [/https:\/\/www\.dreamos86\.com/g, "https://vodex.dev"],
  [/dreamos86\.com/g, "vodex.dev"],
  [/auth\.dreamos86\.com/g, "auth.vodex.dev"],
  [/dreamos86\.app/g, "vodex.app"],
  [/cname\.dreamos86\.com/g, "cname.vodex.dev"],
  [/DREAMOS86/g, "VODEX LABS"],
  [/DreamOS86/g, "Vodex"],
  [/Dreamos86app/g, "Vodex"],
  [/dreamos86app@gmail\.com/g, "support@vodex.dev"],
  [/@\/components\/brand\/dreamos86-brand-icon/g, "@/components/brand/vodex-brand-icon"],
  [/@\/components\/brand\/dreamos86-brand-lockup/g, "@/components/brand/vodex-brand-lockup"],
  [/dreamos86-paddle-billing/g, "vodex-paddle-billing"],
  [/app-payments-vs-dreamos-billing/g, "app-payments-vs-vodex-billing"],
  [/vodex\.pendingPrompt/g, "vodex.pendingPrompt"],
  [/vodex\.promptDup:/g, "vodex.promptDup:"],
  [/vodex\.submittedOp:/g, "vodex.submittedOp:"],
  [/vodex\.autostartDone:/g, "vodex.autostartDone:"],
  [/vodex\.consumedPrompt:/g, "vodex.consumedPrompt:"],
];

async function walk(dir, out = []) {
  for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) await walk(p, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(ent.name)) out.push(p);
  }
  return out;
}

let changed = 0;
for (const file of await walk(SRC)) {
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  if (SKIP.has(path.normalize(rel))) continue;
  if (rel.includes("legacy-brand-allowlist")) continue;

  let text = await fs.readFile(file, "utf8");
  const before = text;

  for (const [re, rep] of REPLACEMENTS) {
    text = text.replace(re, rep);
  }

  if (text !== before) {
    await fs.writeFile(file, text);
    changed++;
    console.log("updated", rel);
  }
}

console.log(`[migrate-brand-strings] ${changed} files updated`);
