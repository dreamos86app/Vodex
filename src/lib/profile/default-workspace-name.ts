/** Default display name from account email — never generic "My Workspace". */
export function defaultWorkspaceNameFromEmail(email: string | null | undefined): string {
  const raw = (email ?? "").trim().toLowerCase();
  if (!raw || !raw.includes("@")) return "";

  const prefix = raw.split("@")[0]?.replace(/[^a-z0-9._-]/gi, "") ?? "";
  if (!prefix) return "";

  return prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

/** Suffix label when UI needs to clarify this is a Dream Space (not part of the user name). */
export function dreamSpaceContextLabel(): string {
  return "Dream Space";
}

export function isGenericWorkspaceName(name: string | null | undefined): boolean {
  const n = (name ?? "").trim().toLowerCase();
  return (
    !n ||
    n === "my workspace" ||
    n === "workspace" ||
    n === "dream space" ||
    n.endsWith("'s workspace") ||
    n.endsWith(" workspace")
  );
}

export function resolveWorkspaceDisplayName(
  workspaceName: string | null | undefined,
  email: string | null | undefined,
): string {
  if (!isGenericWorkspaceName(workspaceName)) return workspaceName!.trim();
  return defaultWorkspaceNameFromEmail(email);
}
