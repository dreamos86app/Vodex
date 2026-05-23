/** Platform momentum showcase — merged with real DB counts (never below these floors). */
export const PLATFORM_SHOWCASE_STATS = {
  projectsStarted: 50_000,
  projectsLaunched: 1_000,
  dailyVisits: 1_000,
  totalVisits: 1_000_000,
} as const;

export type MergedPublicStats = {
  projectsStarted: number;
  projectsLaunched: number;
  dailyVisits: number;
  totalVisits: number;
  visitsAvailable: boolean;
  source: "live" | "showcase" | "mixed";
};

export function mergeWithShowcaseStats(input: {
  projectsStarted?: number | null;
  projectsLaunched?: number | null;
  dailyVisits?: number | null;
  totalVisits?: number | null;
  visitsAvailable?: boolean;
}): MergedPublicStats {
  const rawStarted = input.projectsStarted ?? 0;
  const rawLaunched = input.projectsLaunched ?? 0;
  const rawDaily = input.dailyVisits ?? 0;
  const rawTotal = input.totalVisits ?? rawDaily;

  const projectsStarted = Math.max(rawStarted, PLATFORM_SHOWCASE_STATS.projectsStarted);
  const projectsLaunched = Math.max(rawLaunched, PLATFORM_SHOWCASE_STATS.projectsLaunched);
  const dailyVisits = Math.max(rawDaily, PLATFORM_SHOWCASE_STATS.dailyVisits);
  const totalVisits = Math.max(rawTotal, PLATFORM_SHOWCASE_STATS.totalVisits);

  const usedShowcase =
    projectsStarted > rawStarted ||
    projectsLaunched > rawLaunched ||
    dailyVisits > rawDaily ||
    totalVisits > rawTotal;

  return {
    projectsStarted,
    projectsLaunched,
    dailyVisits,
    totalVisits,
    visitsAvailable: input.visitsAvailable ?? true,
    source: usedShowcase ? (rawStarted === 0 && rawLaunched === 0 ? "showcase" : "mixed") : "live",
  };
}

export function showcaseStatsFallback(): MergedPublicStats {
  return {
    ...PLATFORM_SHOWCASE_STATS,
    visitsAvailable: true,
    source: "showcase",
  };
}
