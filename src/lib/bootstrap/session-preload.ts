/**
 * Warm caches during session intro — non-blocking, best-effort.
 */
import { runCreditsBootstrap } from "@/lib/credits/credits-bootstrap";
import type { Profile } from "@/lib/supabase/types";

export function runSessionPreload(userId: string, profile?: Partial<Profile> | null): void {
  if (!userId || typeof window === "undefined") return;

  runCreditsBootstrap(userId, profile ?? null);

  void Promise.allSettled([
    fetch("/api/projects?limit=12", { credentials: "include", cache: "no-store" }),
  ]);
}
