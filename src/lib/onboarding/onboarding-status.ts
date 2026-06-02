import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getCachedBootstrap,
  invalidateBootstrapCache,
  setCachedBootstrap,
} from "@/lib/cache/session-bootstrap-cache";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/supabase/types";
import { setOnboardingIntroPending } from "@/lib/session/session-intro-decision";

const SESSION_KEY_PREFIX = "vodex:onboarding-complete:";

/** Client-side: profile flag is explicitly true. */
export function isProfileOnboardingComplete(
  profile: Partial<Profile> | null | undefined,
): boolean {
  return profile?.onboarding_completed === true;
}

/** Never regress onboarding completion from stale cache or partial profile rows. */
export function mergeProfileOnboardingStatus(
  current: Partial<Profile> | null | undefined,
  incoming: Partial<Profile>,
): Partial<Profile> {
  const completed =
    current?.onboarding_completed === true || incoming.onboarding_completed === true;
  if (!completed) return incoming;
  return {
    ...incoming,
    onboarding_completed: true,
    onboarding_completed_at:
      incoming.onboarding_completed_at ??
      current?.onboarding_completed_at ??
      new Date().toISOString(),
    signup_wizard_completed:
      incoming.signup_wizard_completed ?? current?.signup_wizard_completed ?? true,
  };
}

export function hasSessionOnboardingComplete(userId: string | undefined): boolean {
  if (!userId || typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(`${SESSION_KEY_PREFIX}${userId}`) === "1";
  } catch {
    return false;
  }
}

/** After POST /api/onboarding succeeds — sync client stores so gates do not loop. */
export function applyOnboardingCompleteToClient(
  userId: string,
  profile: Profile,
  setProfile: (p: Profile) => void,
): void {
  const completed: Profile = {
    ...profile,
    onboarding_completed: true,
    onboarding_completed_at: profile.onboarding_completed_at ?? new Date().toISOString(),
    signup_wizard_completed: true,
  };
  setProfile(completed);
  invalidateBootstrapCache(userId);
  const cached = getCachedBootstrap(userId);
  setCachedBootstrap(userId, {
    profile: completed,
    notifications: cached?.notifications ?? [],
  });
  try {
    sessionStorage.setItem(`${SESSION_KEY_PREFIX}${userId}`, "1");
  } catch {
    /* ignore */
  }
  setOnboardingIntroPending(userId);
}

/** Server: profiles row OR onboarding.completed_at / completed flag. */
export async function resolveOnboardingCompleteForUser(
  userId: string,
  supabase?: SupabaseClient,
): Promise<boolean> {
  let profileDone = false;
  if (supabase) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", userId)
      .maybeSingle();
    profileDone = profile?.onboarding_completed === true;
    if (profileDone) return true;
  }

  try {
    const admin = createSupabaseAdmin();
    if (!profileDone && supabase) {
      const { data: profile } = await admin
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", userId)
        .maybeSingle();
      profileDone = profile?.onboarding_completed === true;
      if (profileDone) return true;
    } else if (!supabase) {
      const { data: profile } = await admin
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", userId)
        .maybeSingle();
      profileDone = profile?.onboarding_completed === true;
      if (profileDone) return true;
    }

    const { data: onboarding } = await admin
      .from("onboarding")
      .select("completed_at")
      .eq("user_id", userId)
      .maybeSingle();

    return Boolean(onboarding?.completed_at);
  } catch {
    return profileDone;
  }
}

/** Authoritative client check (GET /api/onboarding). */
export async function fetchOnboardingCompleteFromApi(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4_000);
  try {
    const res = await fetch("/api/onboarding", {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { completed?: boolean };
    return data.completed === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
