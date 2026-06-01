/**
 * Active auth config must use vodex.dev — not dreamos86.com callbacks.
 * Run: npm run verify:oauth-branding
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const SCAN = [
  "src/lib/auth",
  "src/lib/auth.ts",
  "src/app/auth",
  "src/app/api/admin/auth-health",
  ".env.example",
  "src/lib/auth/github-oauth-checklist.ts",
];

const FORBIDDEN = [/https:\/\/dreamos86\.com/i, /dreamos86\.com\/auth\/callback/i];

const ALLOW = [/legacy-brand-allowlist/, /LEGACY_/, /deprecatedUrls/, /OLD_DOMAINS/];

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

async function main() {
  const hits = [];
  for (const rel of SCAN) {
    const abs = path.join(ROOT, rel);
    let files;
    try {
      files = await walk(abs);
    } catch {
      continue;
    }
    for (const file of files) {
      if (!/\.(tsx?|ts|mjs|example)$/.test(file)) continue;
      const text = await fs.readFile(file, "utf8");
      const lines = text.split("\n");
      lines.forEach((line, i) => {
        if (ALLOW.some((re) => re.test(line))) return;
        for (const re of FORBIDDEN) {
          if (re.test(line)) hits.push(`${path.relative(ROOT, file)}:${i + 1} ${line.trim()}`);
        }
      });
    }
  }

  const checklist = await fs.readFile(
    path.join(ROOT, "src/lib/auth/github-oauth-checklist.ts"),
    "utf8",
  );
  if (!checklist.includes("auth/v1/callback")) {
    hits.push("github-oauth-checklist.ts: missing Supabase callback URL");
  }
  if (!checklist.includes("productionAuthCallbackUrl")) {
    hits.push("github-oauth-checklist.ts: missing vodex.dev app callback helper");
  }

  if (hits.length) {
    console.error("verify:oauth-branding FAILED\n");
    hits.forEach((h) => console.error("  -", h));
    process.exit(1);
  }
  console.log("verify:oauth-branding OK");
}

main();
