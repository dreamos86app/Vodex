import type { StatusLevel } from "@/lib/status/status-types";

/** Simplified public status rows (Lovable-style) — shown to non-owner users. */
export type PublicStatusSurfaceRow = {
  key: string;
  name: string;
  group_name: "Functionalities" | "Services";
  sourceKeys: string[];
};

export const PUBLIC_STATUS_SURFACE: PublicStatusSurfaceRow[] = [
  {
    key: "application_preview",
    name: "Application Preview",
    group_name: "Functionalities",
    sourceKeys: ["preview_rendering", "app_generation"],
  },
  {
    key: "billing",
    name: "Billing",
    group_name: "Functionalities",
    sourceKeys: ["paddle_checkout", "subscription_sync", "credits_usage", "upgrade_flow"],
  },
  {
    key: "builder",
    name: "Builder",
    group_name: "Functionalities",
    sourceKeys: ["ai_builder", "build_queue", "edit_mode", "code_export"],
  },
  {
    key: "data",
    name: "Data",
    group_name: "Functionalities",
    sourceKeys: ["supabase"],
  },
  {
    key: "files_images_serving",
    name: "Files & Images Serving",
    group_name: "Functionalities",
    sourceKeys: ["images_serving", "file_storage"],
  },
  {
    key: "file_uploads",
    name: "File Uploads",
    group_name: "Functionalities",
    sourceKeys: ["file_storage"],
  },
  {
    key: "hosting",
    name: "Hosting",
    group_name: "Functionalities",
    sourceKeys: ["vercel_hosting"],
  },
  {
    key: "login",
    name: "Login",
    group_name: "Functionalities",
    sourceKeys: ["login", "platform"],
  },
  {
    key: "platform",
    name: "Platform",
    group_name: "Services",
    sourceKeys: ["platform", "dashboard", "admin_panel"],
  },
  {
    key: "published_applications",
    name: "Published Applications",
    group_name: "Services",
    sourceKeys: ["published_apps"],
  },
  {
    key: "website",
    name: "Website",
    group_name: "Services",
    sourceKeys: ["platform", "vercel_hosting"],
  },
];

const STATUS_RANK: Record<StatusLevel, number> = {
  operational: 0,
  maintenance: 1,
  degraded: 2,
  partial_outage: 3,
  major_outage: 4,
};

export function worstOfStatuses(levels: StatusLevel[]): StatusLevel {
  if (levels.length === 0) return "operational";
  return levels.reduce((a, b) => (STATUS_RANK[a] >= STATUS_RANK[b] ? a : b));
}

export function aggregatePublicSurface<T extends { key: string; current_status: StatusLevel }>(
  detailed: T[],
): Array<{
  key: string;
  name: string;
  group_name: string;
  current_status: StatusLevel;
}> {
  const byKey = new Map(detailed.map((c) => [c.key, c]));
  return PUBLIC_STATUS_SURFACE.map((row) => {
    const statuses = row.sourceKeys
      .map((k) => byKey.get(k)?.current_status)
      .filter((s): s is StatusLevel => Boolean(s));
    return {
      key: row.key,
      name: row.name,
      group_name: row.group_name,
      current_status: worstOfStatuses(statuses.length ? statuses : ["operational"]),
    };
  });
}
