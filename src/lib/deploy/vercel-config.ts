export type VercelConnectionState =
  | "not_connected"
  | "token_invalid"
  | "token_only"
  | "needs_project_link"
  | "missing_env"
  | "ready";

export function getVercelServerConfig(projectMeta?: Record<string, unknown>) {
  const token = process.env.VERCEL_ACCESS_TOKEN?.trim() ?? "";
  const teamId = process.env.VERCEL_TEAM_ID?.trim() || null;
  const globalProjectId = process.env.VERCEL_PROJECT_ID?.trim() || null;
  const linkedProjectId =
    typeof projectMeta?.vercel_project_id === "string"
      ? projectMeta.vercel_project_id
      : globalProjectId;

  let state: VercelConnectionState = "not_connected";
  if (!token) state = "not_connected";
  else if (linkedProjectId) state = "ready";
  else state = "needs_project_link";

  return {
    token,
    teamId,
    projectId: linkedProjectId,
    state,
    hasToken: Boolean(token),
  };
}
