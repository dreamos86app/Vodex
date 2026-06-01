/**
 * Admin owner must route to vodexlabs@gmail.com — not expose old Gmail in UI.
 * Run: npm run verify:admin-owner-email
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const UI_SCAN = ["src/components", "src/app"];
const SERVER_SCAN = ["src/lib/admin", "src/lib/email", "src/lib/brand/brand-config.ts"];

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
  const errors = [];

  const allowlist = await fs.readFile(
    path.join(ROOT, "src/lib/brand/legacy-brand-allowlist.ts"),
    "utf8",
  );
  if (!allowlist.includes("ADMIN_OWNER_EMAIL")) {
    errors.push("legacy-brand-allowlist.ts: must use ADMIN_OWNER_EMAIL from brand-config");
  }
  if (!/ADMIN_OWNER_EMAIL/.test(allowlist)) {
    errors.push("legacy-brand-allowlist.ts: missing ADMIN_OWNER_EMAIL wiring");
  }

  const brandConfig = await fs.readFile(
    path.join(ROOT, "src/lib/brand/brand-config.ts"),
    "utf8",
  );
  if (!brandConfig.includes('ADMIN_OWNER_EMAIL = "vodexlabs@gmail.com"')) {
    errors.push("brand-config.ts: ADMIN_OWNER_EMAIL must be vodexlabs@gmail.com");
  }

  for (const dir of UI_SCAN) {
    const files = await walk(path.join(ROOT, dir));
    for (const file of files) {
      if (!/\.(tsx?)$/.test(file)) continue;
      if (file.includes("legacy-brand-allowlist")) continue;
      const text = await fs.readFile(file, "utf8");
      if (/dreamos86app@gmail\.com/i.test(text)) {
        errors.push(`${path.relative(ROOT, file)}: exposes dreamos86app@gmail.com in UI`);
      }
    }
  }

  const otp = await fs.readFile(
    path.join(ROOT, "src/lib/admin/send-owner-otp-email.ts"),
    "utf8",
  );
  if (!otp.includes("DREAMOS_OWNER_EMAIL")) {
    errors.push("send-owner-otp-email.ts: must use DREAMOS_OWNER_EMAIL");
  }

  if (errors.length) {
    console.error("verify:admin-owner-email FAILED\n");
    errors.forEach((e) => console.error("  -", e));
    process.exit(1);
  }
  console.log("verify:admin-owner-email OK");
}

main();
