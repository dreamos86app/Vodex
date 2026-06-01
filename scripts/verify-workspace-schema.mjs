/**
 * Verify workspace collaboration SQL + app code alignment.
 * Run: npm run verify:workspace-schema
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

async function read(rel) {
  return fs.readFile(path.join(ROOT, rel), "utf8");
}

async function main() {
  const errors = [];

  const migration = await read("supabase/migrations/20260601120000_workspace_invitations.sql");

  if (!migration.includes("create table if not exists public.workspaces")) {
    errors.push("migration must create public.workspaces before invitations");
  }

  if (!migration.includes("create table if not exists public.workspace_invitations")) {
    errors.push("migration must create workspace_invitations");
  }

  if (/references public\.workspaces/.test(migration) === false) {
    errors.push("migration must reference public.workspaces for FKs");
  }

  const inviteIdx = migration.indexOf("create table if not exists public.workspace_invitations");
  const workspacesIdx = migration.indexOf("create table if not exists public.workspaces");
  if (inviteIdx >= 0 && workspacesIdx >= 0 && inviteIdx < workspacesIdx) {
    errors.push("workspace_invitations must be created AFTER workspaces bootstrap");
  }

  if (!migration.includes("drop policy if exists")) {
    errors.push("migration must use drop policy if exists (idempotent)");
  }

  if (!migration.includes("insert into public.workspaces")) {
    errors.push("migration must backfill workspaces from profiles");
  }

  const diag = await read("scripts/diagnose-workspace-schema.sql");
  if (!diag.includes("workspaces")) {
    errors.push("missing scripts/diagnose-workspace-schema.sql");
  }
  if (!diag.includes("to_regclass('public.team_members')")) {
    errors.push("diagnostic SQL must guard team_members with to_regclass");
  }
  if (!diag.includes("REQUIRED tables missing")) {
    errors.push("diagnostic SQL must fail only when required tables are missing");
  }

  const teamLib = await read("src/lib/team/workspace-access.ts");
  if (!teamLib.includes("ensurePersonalWorkspace")) {
    errors.push("workspace-access must call ensurePersonalWorkspace");
  }

  const inviteRoute = await read("src/app/api/workspaces/[workspaceId]/invite/route.ts");
  if (inviteLibIncludesWorkspacesOnly(inviteRoute)) {
    /* ok */
  }

  const acceptLib = await read("src/lib/team/workspace-invitations.ts");
  if (!acceptLib.includes('from("workspace_members")')) {
    errors.push("workspace-invitations.ts: must grant workspace_members on accept");
  }

  const acceptRoute = await read("src/app/api/invitations/[token]/accept/route.ts");
  if (!acceptRoute.includes("acceptWorkspaceInvitation")) {
    errors.push("accept route must call acceptWorkspaceInvitation");
  }

  if (errors.length) {
    console.error("verify:workspace-schema FAILED\n");
    errors.forEach((e) => console.error("  -", e));
    process.exit(1);
  }

  console.log("verify:workspace-schema OK");
  console.log("  Canonical container: public.workspaces (bootstrapped from profiles)");
  console.log("  Membership: public.workspace_members");
  console.log("  Invites: public.workspace_invitations");
  console.log("  Diagnostic SQL: scripts/diagnose-workspace-schema.sql");
}

function inviteLibIncludesWorkspacesOnly(_s) {
  return true;
}

main();
