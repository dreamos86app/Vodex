import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ensurePersonalWorkspace } from "@/lib/identity/ensure-personal-workspace";

export type TeamMemberRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  is_you: boolean;
};

export type TeamInviteRow = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
};

/**
 * Workspace collaborators: `workspace_members` (+ profile fields when readable).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createServiceRoleClient();

  let workspaceId: string | null = null;
  const { data: mem } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (mem?.workspace_id) workspaceId = mem.workspace_id;

  if (!workspaceId) {
    workspaceId = await ensurePersonalWorkspace(supabase, user.id, user.email);
  }

  const { data: owned } = await supabase
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!workspaceId && owned?.id) workspaceId = owned.id;

  const members: TeamMemberRow[] = [];
  const invites: TeamInviteRow[] = [];

  if (workspaceId) {
    const { data: wm } = await supabase
      .from("workspace_members")
      .select("user_id, role")
      .eq("workspace_id", workspaceId);

    const userIds = [...new Set((wm ?? []).map((r) => r.user_id))];
    const roleByUser = new Map((wm ?? []).map((r) => [r.user_id, r.role]));

    const profileById = new Map<
      string,
      { id: string; email: string | null; full_name: string | null; display_name: string | null; avatar_url: string | null }
    >();

    if (userIds.length > 0 && admin) {
      const { data: profs } = await admin
        .from("profiles")
        .select("id, email, full_name, display_name, avatar_url")
        .in("id", userIds);
      for (const p of profs ?? []) {
        profileById.set(p.id, p);
      }
    }

    for (const uid of userIds) {
      const p = profileById.get(uid);
      const role = roleByUser.get(uid) ?? "member";
      members.push({
        user_id: uid,
        email: p?.email ?? (uid === user.id ? user.email ?? null : null),
        display_name: p?.display_name ?? p?.full_name ?? null,
        avatar_url: p?.avatar_url ?? null,
        role,
        is_you: uid === user.id,
      });
    }

    const { data: pendingInvites } = await supabase
      .from("workspace_invitations")
      .select("id, email, role, created_at, expires_at")
      .eq("workspace_id", workspaceId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });

    for (const row of pendingInvites ?? []) {
      if (new Date(row.expires_at) < new Date()) continue;
      invites.push({
        id: row.id,
        email: row.email,
        role: row.role,
        status: "pending",
        created_at: row.created_at,
      });
    }

    if (invites.length === 0) {
      const { data: legacyPending } = await supabase
        .from("team_members")
        .select("id, email, role, status, created_at")
        .eq("workspace_id", workspaceId)
        .eq("status", "pending");
      for (const row of legacyPending ?? []) {
        invites.push({
          id: row.id,
          email: row.email,
          role: row.role,
          status: row.status,
          created_at: row.created_at,
        });
      }
    }
  }

  if (members.length === 0) {
    members.push({
      user_id: user.id,
      email: user.email ?? null,
      display_name: null,
      avatar_url: null,
      role: "owner",
      is_you: true,
    });
  }

  return NextResponse.json({ workspace_id: workspaceId, members, invites });
}
