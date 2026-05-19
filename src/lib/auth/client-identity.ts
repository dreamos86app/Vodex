import type { User } from "@supabase/supabase-js";
import type { Session } from "@supabase/supabase-js";
import type { Profile } from "@/lib/supabase/types";

/** Canonical account email for UI (auth user wins over profile row). */
export function resolveAccountEmail(
  user: User | null | undefined,
  profile: Profile | null | undefined,
): string {
  const fromAuth = user?.email?.trim();
  if (fromAuth) return fromAuth;
  return profile?.email?.trim() ?? "";
}

/** True when Supabase session exists (single source of truth for “signed in”). */
export function hasActiveSession(
  session: Session | null | undefined,
  user: User | null | undefined,
): boolean {
  return Boolean(session?.user?.id ?? user?.id);
}

/** Effective user id for client actions — prefer live session over persisted profile. */
export function resolveEffectiveUserId(
  user: User | null | undefined,
  profile: Profile | null | undefined,
): string | null {
  if (user?.id) return user.id;
  if (profile?.id) return profile.id;
  return null;
}

/** Stale UI: persisted profile without a live session. */
export function isStalePersistedProfile(
  session: Session | null | undefined,
  profile: Profile | null | undefined,
): boolean {
  return Boolean(profile?.id && !session?.user?.id);
}
