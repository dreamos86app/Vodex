const LOCAL_PREFIXES = [
  "dreamos:preview:",
  "vodex:preview:",
  "preview:iframe:",
  "preview-url:",
];

const SESSION_KEYS = ["dreamos:projects-cache", "dreamos_projects_cache"];

export type ClearPreviewCacheResult = {
  clearedLocalKeys: string[];
  clearedSessionKeys: string[];
};

/** Clear client-side preview URL / project list caches so iframe reloads from canonical API. */
export function clearPreviewClientCache(projectId?: string | null): ClearPreviewCacheResult {
  const clearedLocalKeys: string[] = [];
  const clearedSessionKeys: string[] = [];

  if (typeof window === "undefined") {
    return { clearedLocalKeys, clearedSessionKeys };
  }

  try {
    for (const key of Object.keys(localStorage)) {
      const projectScoped =
        projectId &&
        (key.includes(projectId) ||
          key === `preview:${projectId}` ||
          key === `dreamos:preview:${projectId}`);
      const prefixMatch = LOCAL_PREFIXES.some((p) => key.startsWith(p));
      if (prefixMatch || projectScoped) {
        localStorage.removeItem(key);
        clearedLocalKeys.push(key);
      }
    }
  } catch {
    /* ignore */
  }

  try {
    for (const key of SESSION_KEYS) {
      sessionStorage.removeItem(key);
      clearedSessionKeys.push(key);
    }
    if (projectId) {
      for (const key of Object.keys(sessionStorage)) {
        if (key.includes(projectId) && key.toLowerCase().includes("preview")) {
          sessionStorage.removeItem(key);
          clearedSessionKeys.push(key);
        }
      }
    }
  } catch {
    /* ignore */
  }

  if (typeof console !== "undefined") {
    console.info("[preview-cache] cleared", { projectId, clearedLocalKeys, clearedSessionKeys });
  }

  return { clearedLocalKeys, clearedSessionKeys };
}
