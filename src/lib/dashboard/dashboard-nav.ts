import type { DashboardSectionId } from "@/lib/dashboard/section-access";

export type DashboardNavItem = {
  id: DashboardSectionId | "auth" | "template";
  label: string;
};

/** Primary dashboard navigation — P1.1 mobile-native IA. */
export const DASHBOARD_NAV: DashboardNavItem[] = [
  { id: "overview", label: "Overview" },
  { id: "publish", label: "Deploy" },
  { id: "analytics", label: "Analytics" },
  { id: "users", label: "Users" },
  { id: "data", label: "Data" },
  { id: "domains", label: "Domains" },
  { id: "integrations", label: "Integrations" },
  { id: "secrets", label: "Secrets" },
  { id: "payments", label: "Payments" },
  { id: "security", label: "Security" },
  { id: "auth", label: "Authentication" },
  { id: "code", label: "Code" },
  { id: "template", label: "App Template" },
  { id: "settings", label: "Settings" },
];

const STORAGE_PREFIX = "vodex:dashboard-section:";

export function readStoredDashboardSection(projectId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${projectId}`);
  } catch {
    return null;
  }
}

export function storeDashboardSection(projectId: string, section: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${projectId}`, section);
  } catch {
    /* ignore */
  }
}

export function isDashboardNavSection(id: string): id is DashboardNavItem["id"] {
  return DASHBOARD_NAV.some((n) => n.id === id);
}
