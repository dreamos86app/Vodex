import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { siteUrl } from "@/lib/app-url";
import { sendWorkspaceInviteEmail } from "@/lib/email/workspace-invite-email";
import { generateInviteToken, hashInviteToken } from "@/lib/team/invite-tokens";
import type { WorkspaceAccess } from "@/lib/team/workspace-access";

const INVITE_TTL_DAYS = 7;

export type WorkspaceInviteRow = {
  id: string;
  workspace_id: string;
  email: string;
  role: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type InvitePreview = {
  status: "pending" | "expired" | "revoked" | "accepted" | "not_found";
  workspace_name?: string;
  email?: string;
  role?: string;
  expires_at?: string;
};

function inviteExpiresAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + INVITE_TTL_DAYS);
  return d.toISOString();
}

export async function createWorkspaceInvitation(
  admin: SupabaseClient<Database>,
  input: {
    workspaceId: string;
    email: string;
    role: "admin" | "editor" | "viewer";
    invitedBy: string;
    inviterName: string;
    inviterEmail: string;
    workspaceName: string;
  },
): Promise<{ invite: WorkspaceInviteRow; rawToken: string; emailSent: boolean }> {
  const email = input.email.trim().toLowerCase();
  const { raw, hash } = generateInviteToken();
  const expires_at = inviteExpiresAt();

  const { data: existing } = await admin
    .from("workspace_invitations")
    .select("id, accepted_at, revoked_at")
    .eq("workspace_id", input.workspaceId)
    .ilike("email", email)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .maybeSingle();

  if (existing?.id) {
    await admin
      .from("workspace_invitations")
      .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never)
      .eq("id", existing.id);
  }

  const { data: row, error } = await admin
    .from("workspace_invitations")
    .insert({
      workspace_id: input.workspaceId,
      email,
      role: input.role,
      token_hash: hash,
      invited_by: input.invitedBy,
      expires_at,
    } as never)
    .select("id, workspace_id, email, role, expires_at, accepted_at, revoked_at, created_at")
    .single();

  if (error || !row) {
    throw new Error(error?.message ?? "Could not create invitation");
  }

  const acceptUrl = siteUrl(`/invite/${raw}`);
  const mail = await sendWorkspaceInviteEmail({
    to: email,
    workspaceName: input.workspaceName,
    inviterName: input.inviterName,
    inviterEmail: input.inviterEmail,
    role: input.role,
    acceptUrl,
    expiresAt: new Date(expires_at),
  });

  return {
    invite: row as WorkspaceInviteRow,
    rawToken: raw,
    emailSent: mail.deliveredToInbox || mail.channel === "dev_console",
  };
}

export async function getInvitationPreview(
  admin: SupabaseClient<Database>,
  rawToken: string,
): Promise<InvitePreview> {
  const hash = hashInviteToken(rawToken);
  const { data: inv } = await admin
    .from("workspace_invitations")
    .select("email, role, expires_at, accepted_at, revoked_at, workspace_id")
    .eq("token_hash", hash)
    .maybeSingle();

  if (!inv) return { status: "not_found" };

  if (inv.revoked_at) return { status: "revoked", email: inv.email, role: inv.role };
  if (inv.accepted_at) return { status: "accepted", email: inv.email, role: inv.role };
  if (new Date(inv.expires_at) < new Date()) {
    return { status: "expired", email: inv.email, role: inv.role, expires_at: inv.expires_at };
  }

  const { data: ws } = await admin
    .from("workspaces")
    .select("name")
    .eq("id", inv.workspace_id)
    .maybeSingle();

  return {
    status: "pending",
    workspace_name: ws?.name ?? "Workspace",
    email: inv.email,
    role: inv.role,
    expires_at: inv.expires_at,
  };
}

export async function acceptWorkspaceInvitation(
  admin: SupabaseClient<Database>,
  rawToken: string,
  userId: string,
  userEmail: string,
): Promise<{ workspaceId: string; role: string }> {
  const hash = hashInviteToken(rawToken);
  const { data: inv } = await admin
    .from("workspace_invitations")
    .select("*")
    .eq("token_hash", hash)
    .maybeSingle();

  if (!inv) throw new InviteError("not_found", "Invitation not found");
  if (inv.revoked_at) throw new InviteError("revoked", "This invitation was revoked");
  if (inv.accepted_at) throw new InviteError("already_accepted", "Invitation already accepted");
  if (new Date(inv.expires_at) < new Date()) throw new InviteError("expired", "Invitation expired");

  const normalizedInviteEmail = inv.email.trim().toLowerCase();
  const normalizedUserEmail = userEmail.trim().toLowerCase();
  if (normalizedInviteEmail !== normalizedUserEmail) {
    throw new InviteError(
      "wrong_email",
      `Sign in as ${inv.email} to accept this invitation`,
    );
  }

  const role = inv.role as string;

  const { error: memberErr } = await admin.from("workspace_members").upsert(
    {
      workspace_id: inv.workspace_id,
      user_id: userId,
      role,
    } as never,
    { onConflict: "workspace_id,user_id" },
  );

  if (memberErr) throw new Error(memberErr.message);

  await admin
    .from("workspace_invitations")
    .update({
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", inv.id);

  const { data: pendingTeam } = await admin
    .from("team_members")
    .select("id")
    .eq("workspace_id", inv.workspace_id)
    .ilike("email", normalizedInviteEmail)
    .eq("status", "pending")
    .maybeSingle();

  if (pendingTeam?.id) {
    await admin
      .from("team_members")
      .update({
        status: "active",
        user_id: userId,
        accepted_at: new Date().toISOString(),
      } as never)
      .eq("id", pendingTeam.id);
  }

  return { workspaceId: inv.workspace_id, role };
}

export class InviteError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "InviteError";
  }
}

export async function revokeWorkspaceInvitation(
  admin: SupabaseClient<Database>,
  workspaceId: string,
  inviteId: string,
): Promise<void> {
  const { error } = await admin
    .from("workspace_invitations")
    .update({
      revoked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", inviteId)
    .eq("workspace_id", workspaceId)
    .is("accepted_at", null);

  if (error) throw new Error(error.message);
}

export async function resendWorkspaceInvitation(
  admin: SupabaseClient<Database>,
  input: {
    workspaceId: string;
    inviteId: string;
    inviterName: string;
    inviterEmail: string;
    workspaceName: string;
  },
): Promise<{ rawToken: string; emailSent: boolean }> {
  const { data: inv } = await admin
    .from("workspace_invitations")
    .select("*")
    .eq("id", input.inviteId)
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();

  if (!inv || inv.revoked_at || inv.accepted_at) {
    throw new Error("Invitation is not pending");
  }
  if (new Date(inv.expires_at) < new Date()) {
    throw new Error("Invitation expired — send a new invite");
  }

  const { raw, hash } = generateInviteToken();
  const expires_at = inviteExpiresAt();

  const { error } = await admin
    .from("workspace_invitations")
    .update({
      token_hash: hash,
      expires_at,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", inv.id);

  if (error) throw new Error(error.message);

  const acceptUrl = siteUrl(`/invite/${raw}`);
  const mail = await sendWorkspaceInviteEmail({
    to: inv.email,
    workspaceName: input.workspaceName,
    inviterName: input.inviterName,
    inviterEmail: input.inviterEmail,
    role: inv.role,
    acceptUrl,
    expiresAt: new Date(expires_at),
  });

  return { rawToken: raw, emailSent: mail.deliveredToInbox || mail.channel === "dev_console" };
}

export function assertCanManageMembers(access: WorkspaceAccess | null): asserts access is WorkspaceAccess {
  if (!access?.canManageMembers) {
    throw new Error("Not authorized to manage workspace members");
  }
}
