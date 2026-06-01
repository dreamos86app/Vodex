/** Notify home/apps lists to refetch after identity, icon, or name updates. */

export const PROJECT_CATALOG_UPDATED = "vodex:project-catalog-updated";

export function notifyProjectCatalogUpdated(projectId?: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(PROJECT_CATALOG_UPDATED, { detail: { projectId: projectId ?? null } }),
  );
  window.dispatchEvent(new Event("dreamos:projects-invalidate"));
}

export function subscribeProjectCatalogUpdated(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => listener();
  window.addEventListener(PROJECT_CATALOG_UPDATED, handler);
  return () => window.removeEventListener(PROJECT_CATALOG_UPDATED, handler);
}
