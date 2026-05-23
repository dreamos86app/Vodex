import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { mergeWithShowcaseStats, showcaseStatsFallback } from "@/lib/public/platform-showcase-stats";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export type PublicStatsResponse = {
  ok: boolean;
  projectsStarted: number | null;
  projectsLaunched: number | null;
  dailyVisits: number | null;
  totalVisits: number | null;
  visitsAvailable: boolean;
  source?: "live" | "showcase" | "mixed";
  message?: string;
};

const QUERY_BUDGET_MS = 2_500;

async function withBudget<T>(promise: PromiseLike<T>, fallback: T): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), QUERY_BUDGET_MS)),
  ]);
}

/** Platform momentum stats — real counts merged with showcase floors. */
export async function GET() {
  const admin = createServiceRoleClient();
  if (!admin) {
    const fb = showcaseStatsFallback();
    return NextResponse.json({
      ok: true,
      projectsStarted: fb.projectsStarted,
      projectsLaunched: fb.projectsLaunched,
      dailyVisits: fb.dailyVisits,
      totalVisits: fb.totalVisits,
      visitsAvailable: true,
      source: "showcase",
    } satisfies PublicStatsResponse);
  }

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [projectsStarted, projectsLaunched, visitCount, totalVisitCount] = await Promise.all([
      withBudget(
        admin.from("projects").select("id", { count: "exact", head: true }).then((r) => r.count ?? 0),
        0,
      ),
      withBudget(
        admin
          .from("published_apps" as never)
          .select("id", { count: "exact", head: true })
          .eq("status" as never, "published" as never)
          .then((r) => r.count ?? 0),
        0,
      ),
      withBudget(
        admin
          .from("analytics_events")
          .select("id", { count: "exact", head: true })
          .gte("created_at", since)
          .eq("event_type", "page_view")
          .then((r) => (r.error ? 0 : (r.count ?? 0))),
        0,
      ),
      withBudget(
        admin
          .from("analytics_events")
          .select("id", { count: "exact", head: true })
          .eq("event_type", "page_view")
          .then((r) => (r.error ? 0 : (r.count ?? 0))),
        0,
      ),
    ]);

    const merged = mergeWithShowcaseStats({
      projectsStarted,
      projectsLaunched,
      dailyVisits: visitCount,
      totalVisits: totalVisitCount,
      visitsAvailable: true,
    });

    return NextResponse.json({
      ok: true,
      projectsStarted: merged.projectsStarted,
      projectsLaunched: merged.projectsLaunched,
      dailyVisits: merged.dailyVisits,
      totalVisits: merged.totalVisits,
      visitsAvailable: merged.visitsAvailable,
      source: merged.source,
    } satisfies PublicStatsResponse);
  } catch {
    const fb = showcaseStatsFallback();
    return NextResponse.json({
      ok: true,
      projectsStarted: fb.projectsStarted,
      projectsLaunched: fb.projectsLaunched,
      dailyVisits: fb.dailyVisits,
      totalVisits: fb.totalVisits,
      visitsAvailable: true,
      source: "showcase",
    } satisfies PublicStatsResponse);
  }
}
