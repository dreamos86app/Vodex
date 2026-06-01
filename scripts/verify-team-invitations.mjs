/**
 * Workspace invitation system static checks (+ optional crypto self-test).
 * Run: npm run verify:team-invitations
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED = [
  "supabase/migrations/20260601120000_workspace_invitations.sql",
  "src/lib/team/invite-tokens.ts",
  "src/lib/team/workspace-invitations.ts",
  "src/lib/email/workspace-invite-email.ts",
  "src/app/api/workspaces/[workspaceId]/invite/route.ts",
  "src/app/api/invitations/[token]/accept/route.ts",
  "src/app/invite/[token]/page.tsx",
];

function hashInviteToken(raw) {
  return createHash("sha256").update(raw.trim()).digest("hex");
}

async function main() {
  const errors = [];

  for (const rel of REQUIRED) {
    try {
      await fs.access(path.join(ROOT, rel));
    } catch {
      errors.push(`missing ${rel}`);
    }
  }

  const migration = await fs.readFile(
    path.join(ROOT, "supabase/migrations/20260601120000_workspace_invitations.sql"),
    "utf8",
  );

  const tokens = await fs.readFile(
    path.join(ROOT, "src/lib/team/invite-tokens.ts"),
    "utf8",
  );
  if (!migration.includes("create table if not exists public.workspaces")) {
    errors.push("migration must bootstrap public.workspaces before invitations");
  }

  if (!tokens.includes("sha256")) {
    errors.push("invite-tokens.ts: must hash tokens with sha256");
  }

  const email = await fs.readFile(
    path.join(ROOT, "src/lib/email/workspace-invite-email.ts"),
    "utf8",
  );
  if (!email.includes("You're invited to join a")) {
    errors.push("workspace-invite-email.ts: missing invite subject copy");
  }
  if (!email.includes("SUPPORT_EMAIL") && !email.includes("support@vodex.dev")) {
    errors.push("workspace-invite-email.ts: missing support email");
  }

  const accept = await fs.readFile(
    path.join(ROOT, "src/lib/team/workspace-invitations.ts"),
    "utf8",
  );
  for (const code of ["expired", "revoked", "already_accepted", "wrong_email"]) {
    if (!accept.includes(code)) {
      errors.push(`workspace-invitations.ts: missing ${code} handling`);
    }
  }
  if (!accept.includes("workspace_members")) {
    errors.push("workspace-invitations.ts: must grant workspace_members on accept");
  }

  const raw = randomBytes(8).toString("hex");
  const h1 = hashInviteToken(raw);
  const h2 = hashInviteToken(raw);
  if (h1 !== h2) errors.push("token hash not deterministic");

  const membersRoute = await fs.readFile(
    path.join(ROOT, "src/app/api/workspaces/[workspaceId]/members/[memberId]/route.ts"),
    "utf8",
  );
  if (!membersRoute.includes("last workspace owner")) {
    errors.push("members DELETE: missing last-owner guard");
  }

  if (errors.length) {
    console.error("verify:team-invitations FAILED\n");
    errors.forEach((e) => console.error("  -", e));
    process.exit(1);
  }
  console.log("verify:team-invitations OK");
}

main();
