import "server-only";

/** Icon URL for preview auth pages — always resolves to a loadable image in the iframe. */
export function resolvePreviewAppIconUrl(input: {
  projectId: string;
  iconUrl?: string | null;
  metadata?: Record<string, unknown> | null;
}): string {
  const direct = input.iconUrl?.trim();
  if (direct && (direct.startsWith("http://") || direct.startsWith("https://") || direct.startsWith("/"))) {
    return direct;
  }

  const meta = input.metadata ?? {};
  const iconPath = typeof meta.icon_path === "string" ? meta.icon_path.trim() : "";
  if (iconPath && (iconPath.startsWith("http://") || iconPath.startsWith("https://") || iconPath.startsWith("/"))) {
    return iconPath;
  }

  return `/api/projects/${input.projectId}/icon`;
}
