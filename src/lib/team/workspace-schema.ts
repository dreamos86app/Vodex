/**
 * Canonical DB names for workspace collaboration.
 * API routes use `workspaceId`; DB container is `public.workspaces`.
 */
export const WORKSPACE_TABLE = "workspaces" as const;
export const WORKSPACE_MEMBERS_TABLE = "workspace_members" as const;
export const WORKSPACE_INVITATIONS_TABLE = "workspace_invitations" as const;

/** Legacy pending invites table (optional in partial schemas). */
export const TEAM_MEMBERS_TABLE = "team_members" as const;
