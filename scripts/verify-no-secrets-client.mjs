#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const ok = [];

const FORBIDDEN_CLIENT_PATTERNS = [
  /createServiceRoleClient\s*\(/,
  /createSupabaseAdmin\s*\(/,
  /process\.env\.(SUPABASE_SERVICE_ROLE|STRIPE_SECRET|OPENAI_API_KEY)/,
  /sk_live_[a-zA-Z0-9]{10,}/,
];

const scanDirs = ["src/components", "src/hooks", "src/lib/stores", "src/app/(app)", "src/app/(workspace)"];

function scanDir(rel) {
  const d = path.join(root, rel);
  if (!fs.existsSync(d)) return;
  for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, ent.name);
    const relP = path.relative(root, p);
    if (ent.isDirectory()) scanDir(relP);
    else if (/\.(tsx|ts|jsx|js)$/.test(ent.name)) {
      const t = fs.readFileSync(p, "utf8");
      const isClient = t.includes('"use client"') || t.includes("'use client'");
      if (!isClient && !rel.startsWith("src/components")) continue;
      for (const re of FORBIDDEN_CLIENT_PATTERNS) {
        if (re.test(t)) errors.push(`${relP} matches ${re}`);
      }
    }
  }
}

for (const d of scanDirs) scanDir(d);
if (errors.length === 0) ok.push("no banned secret patterns in client-facing src");

const exportRoute = path.join(root, "src/app/api/deploy/export/route.ts");
if (fs.existsSync(exportRoute)) {
  const t = fs.readFileSync(exportRoute, "utf8");
  if (t.includes("isSecretPath") && t.includes("SECRET_PATTERN") && t.includes(".env.example")) {
    ok.push("export ZIP strips secrets and ships .env.example only");
  } else errors.push("export route missing secret stripping");
}

const publishSvc = path.join(root, "src/lib/publish/publish-service.ts");
if (fs.existsSync(publishSvc) && fs.readFileSync(publishSvc, "utf8").includes("stripSecretsFromFiles")) {
  ok.push("published snapshots strip secrets");
} else errors.push("publish-service missing stripSecretsFromFiles");

console.log("\n=== verify:no-secrets-client ===\n");
ok.forEach((m) => console.log(`✓ ${m}`));
errors.forEach((m) => console.error(`✗ ${m}`));
process.exit(errors.length ? 1 : 0);
