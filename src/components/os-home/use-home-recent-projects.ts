"use client";

import * as React from "react";
import type { YourAppsProject } from "@/components/os-home/your-apps-section";
import { subscribeProjectCatalogUpdated } from "@/lib/projects/project-catalog-sync";

export function useHomeRecentProjects() {
  const [projects, setProjects] = React.useState<YourAppsProject[]>([]);
  const [loading, setLoading] = React.useState(true);

  const reload = React.useCallback(async () => {
    try {
      const res = await fetch("/api/home/recent-projects", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return;
      const payload = (await res.json()) as { projects?: YourAppsProject[] };
      if (Array.isArray(payload.projects)) {
        setProjects(payload.projects);
      }
    } catch {
      /* non-blocking */
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void reload();
    return subscribeProjectCatalogUpdated(() => {
      void reload();
    });
  }, [reload]);

  return { projects, loading, reload };
}
