/**
 * Warm caches during session intro — credits start at 0ms, apps list in parallel.
 */
import { beginSessionCreditsWarmup } from "@/lib/credits/session-credits-warmup";
import type { Profile } from "@/lib/supabase/types";

export function runSessionPreload(userId: string, profile?: Partial<Profile> | null): void {
  if (!userId || typeof window === "undefined") return;

  beginSessionCreditsWarmup(userId, profile ?? null);

  void Promise.allSettled([
    fetch("/api/projects?limit=12", { credentials: "include", cache: "no-store" }),
    fetch("/api/home/recent-projects", { credentials: "include", cache: "no-store" }).catch(() => null),
  ]);
}
