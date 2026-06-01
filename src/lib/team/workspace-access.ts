import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { ensurePersonalWorkspace } from "@/lib/identity/ensure-personal-workspace";

export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer";

export type WorkspaceAccess = {
  workspaceId: string;
  role: WorkspaceRole;
  canManageMembers: boolean;
  canEditProjects: boolean;
};

function normalizeRole(role: string | null | undefined): WorkspaceRole {
  const r = (role ?? "viewer").toLowerCase();
  if (r === "owner" || r === "admin" || r === "editor" || r === "viewer") return r;
  if (r === "member") return "editor";
  return "viewer";
}

/** Resolve workspace access for authenticated user — never trust client user_id alone. */
export async function getWorkspaceAccess(
  supabase: SupabaseClient<Database>,
  userId: string,
  workspaceId: string,
): Promise<WorkspaceAccess | null> {
  const { data: owned } = await supabase
    .from("workspaces")
    .select("id")
    .eq("id", workspaceId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (owned?.id) {
    return {
      workspaceId,
      role: "owner",
      canManageMembers: true,
      canEditProjects: true,
    };
  }

  const { data: member } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!member) return null;

  const role = normalizeRole(member.role);
  return {
    workspaceId,
    role,
    canManageMembers: role === "owner" || role === "admin",
    canEditProjects: role === "owner" || role === "admin" || role === "editor",
  };
}

export async function resolvePrimaryWorkspaceId(
  supabase: SupabaseClient<Database>,
  userId: string,
  email?: string | null,
): Promise<string | null> {
  const { data: mem } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (mem?.workspace_id) return mem.workspace_id;

  const workspaceId = await ensurePersonalWorkspace(supabase, userId, email);
  return workspaceId || null;
}
