import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";

export async function recordPublishedAnalyticsEvents(input: {
  slug: string;
  projectId: string;
  ownerId: string;
  publishedAppId: string;
  events: Array<{
    event_type: string;
    path?: string;
    meta?: Record<string, unknown>;
  }>;
}): Promise<boolean> {
  const admin = createServiceRoleClient();
  if (!admin || !input.events.length) return false;

  const rows = input.events.map((e) => ({
    project_id: input.projectId,
    owner_id: input.ownerId,
    event_type: e.event_type,
    path: e.path ?? null,
    meta: {
      ...(e.meta ?? {}),
      published_app_id: input.publishedAppId,
      slug: input.slug,
    },
  }));

  const { error } = await admin.from("app_analytics_events" as never).insert(rows as never);
  if (error) {
    console.error("[published-analytics-server]", error.message);
    return false;
  }
  return true;
}
