import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type ProjectRole = "owner" | "admin" | "editor" | "viewer";

export type ProjectAccess = {
  projectId: string;
  workspaceId: string | null;
  ownerId: string;
  role: ProjectRole;
  canEdit: boolean;
};

type Writer = SupabaseClient<Database>;

function roleCanEdit(role: ProjectRole): boolean {
  return role === "owner" || role === "admin" || role === "editor";
}

/**
 * Resolve whether the authenticated user may access a project (server-side only).
 */
export async function getProjectAccess(
  writer: Writer,
  userId: string,
  projectId: string,
): Promise<ProjectAccess | null> {
  const { data: project } = await writer
    .from("projects")
    .select("id, owner_id, workspace_id")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) return null;

  if (project.owner_id === userId) {
    return {
      projectId: project.id,
      workspaceId: project.workspace_id,
      ownerId: project.owner_id,
      role: "owner",
      canEdit: true,
    };
  }

  if (!project.workspace_id) return null;

  const { data: member } = await writer
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", project.workspace_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!member) return null;

  const role = (member.role as ProjectRole) ?? "viewer";
  return {
    projectId: project.id,
    workspaceId: project.workspace_id,
    ownerId: project.owner_id,
    role,
    canEdit: roleCanEdit(role),
  };
}

export async function assertProjectAccess(
  writer: Writer,
  userId: string,
  projectId: string,
  options?: { requireEdit?: boolean },
): Promise<ProjectAccess | null> {
  const access = await getProjectAccess(writer, userId, projectId);
  if (!access) return null;
  if (options?.requireEdit && !access.canEdit) return null;
  return access;
}
