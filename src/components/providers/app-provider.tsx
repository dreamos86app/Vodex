"use client";

/**
 * Vodex — App Provider
 * Bootstraps Supabase auth listener, syncs to Zustand stores,
 * and wires up realtime subscriptions.
 *
 * Client-only: Supabase browser client is created inside useEffect so static
 * prerender (no public env vars) does not instantiate @supabase/ssr.
 */

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useCreditsStore, refreshCredits } from "@/lib/stores/credits-store";
import { useCreditsSync } from "@/hooks/use-credits-sync";
import { useNotificationsStore } from "@/lib/stores/notifications-store";
import type { Notification } from "@/lib/supabase/types";
import { ReferralCapture } from "@/components/referrals/referral-capture";
import { AuthStateDebug } from "@/components/dev/auth-state-debug";
import { hasActiveSession, isStalePersistedProfile } from "@/lib/auth/client-identity";
import { isE2eCreditTestAccount } from "@/lib/credits/e2e-credit-account";
import {
  getCachedBootstrap,
  invalidateBootstrapCache,
  setCachedBootstrap,
} from "@/lib/cache/session-bootstrap-cache";
import { resetCreditsBootstrap } from "@/lib/credits/credits-bootstrap";
import {
  beginSessionCreditsWarmup,
  resetSessionCreditsWarmup,
} from "@/lib/credits/session-credits-warmup";
import {
  loadUserProfileCoreDeduped,
} from "@/lib/supabase/load-user-profile";
import type { Profile } from "@/lib/supabase/types";
import { installChunkLoadRecovery } from "@/lib/navigation/chunk-load-recovery";
import { isOnboardingExemptPath } from "@/lib/onboarding/exempt-paths";
import {
  fetchOnboardingCompleteFromApi,
  hasSessionOnboardingComplete,
  isProfileOnboardingComplete,
  mergeProfileOnboardingStatus,
} from "@/lib/onboarding/onboarding-status";
import { isLightweightPublicPath } from "@/lib/routing/lightweight-public-paths";
import { refreshUserNotificationsFromApi } from "@/lib/notifications/refresh-user-notifications";
import {
  getCachedNotificationPrefs,
  refreshNotificationPrefsFromApi,
} from "@/lib/notifications/notification-prefs-cache";
import {
  shouldPlayInWebSound,
  normalizeNotificationPrefs,
} from "@/lib/notifications/notification-preferences";
import { resolveInWebSoundKey } from "@/lib/notifications/in-web-sound-keys";
import { playNotificationChime } from "@/lib/notifications/notification-sound";
import { usePresenceHeartbeat } from "@/hooks/use-presence-heartbeat";
import { useNotificationSync } from "@/hooks/use-notification-sync";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const lightweightPublic = isLightweightPublicPath(pathname);
  const { setUser, setSession, setProfile, setLoading, reset: resetAuth } =
    useAuthStore();
  const { reset: resetCredits } = useCreditsStore();
  const { setNotifications, addNotification, reset: resetNotifications } =
    useNotificationsStore();

  const profile = useAuthStore((s) => s.profile);
  const session = useAuthStore((s) => s.session);
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const creditsSyncEnabled = Boolean(user?.id ?? profile?.id) && !lightweightPublic;
  useCreditsSync(creditsSyncEnabled);
  usePresenceHeartbeat(creditsSyncEnabled);
  useNotificationSync(creditsSyncEnabled);

  const profileId = profile?.id;
  const profilePlanId = profile?.plan_id;
  const profileCreditsRemaining = profile?.credits_remaining;

  React.useEffect(() => {
    if (lightweightPublic) return;
    if (!profileId) return;
    beginSessionCreditsWarmup(profileId, profile);
  }, [lightweightPublic, profileId, profilePlanId, profileCreditsRemaining]);

  React.useEffect(() => {
    void Promise.resolve(useAuthStore.persist.rehydrate()).then(() => {
      const state = useAuthStore.getState();
      if (state.profile?.id) {
        state.setLoading(false);
        beginSessionCreditsWarmup(state.profile.id, state.profile);
      }
    });
    return installChunkLoadRecovery();
  }, []);

  React.useEffect(() => {
    if (loading) return;
    if (!hasActiveSession(session, user)) return;
    if (!profile?.id) return;
    if (!pathname) return;
    if (pathname.startsWith("/auth")) return;
    if (pathname.startsWith("/api")) return;
    if (pathname === "/terms" || pathname === "/privacy" || pathname === "/contact") {
      return;
    }

    if (
      isProfileOnboardingComplete(profile) ||
      hasSessionOnboardingComplete(profile.id)
    ) {
      return;
    }

    if (isOnboardingExemptPath(pathname)) {
      void (async () => {
        const done = await fetchOnboardingCompleteFromApi();
        if (done) {
          setProfile(mergeProfileOnboardingStatus(profile, { onboarding_completed: true }) as Profile);
        }
      })();
      return;
    }

    void (async () => {
      const done = await fetchOnboardingCompleteFromApi();
      if (done) {
        setProfile(mergeProfileOnboardingStatus(profile, { onboarding_completed: true }) as Profile);
        return;
      }
      if (!isE2eCreditTestAccount(profile.email ?? user?.email)) {
        router.replace(`/onboarding?next=${encodeURIComponent(pathname)}`);
      }
    })();
  }, [loading, session, user, profile, pathname, router]);

  React.useEffect(() => {
    if (lightweightPublic) {
      setLoading(false);
      return;
    }

    const supabase = createClient();
    let bootstrapGeneration = 0;
    let realtimeDispose: (() => void) | undefined;

    const teardownRealtime = () => {
      realtimeDispose?.();
      realtimeDispose = undefined;
    };

    const attachRealtime = (userId: string) => {
      teardownRealtime();

      let creditRefreshTimer: ReturnType<typeof setTimeout> | undefined;
      let lastChimeAt = 0;

      void refreshNotificationPrefsFromApi();

      const notificationsChannel = supabase
        .channel(`notifications:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const row = payload.new as Notification;
            const prefs = getCachedNotificationPrefs();
            const md = row.metadata as Record<string, unknown> | null;
            const allowSound = md?.play_sound !== false;
            addNotification(row);
            const soundKey = resolveInWebSoundKey(row);
            if (
              allowSound &&
              shouldPlayInWebSound(prefs, soundKey) &&
              Date.now() - lastChimeAt > 2000
            ) {
              lastChimeAt = Date.now();
              playNotificationChime();
            }
          },
        )
        .subscribe();

      const profileChannel = supabase
        .channel(`profile:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${userId}`,
          },
          (payload) => {
            const current = useAuthStore.getState().profile;
            if (!current || current.id !== userId) return;
            const prevPlan = current.plan_id;
            const patch = payload.new as Partial<Profile>;
            setProfile({
              ...current,
              ...patch,
            });
            if (creditRefreshTimer) clearTimeout(creditRefreshTimer);
            const planChanged = patch.plan_id != null && patch.plan_id !== prevPlan;
            creditRefreshTimer = setTimeout(
              () =>
                void refreshCredits({
                  reason: planChanged ? "plan-change" : "profile-realtime",
                  force: planChanged,
                }),
              planChanged ? 200 : 1500,
            );
          },
        )
        .subscribe();

      realtimeDispose = () => {
        supabase.removeChannel(notificationsChannel);
        supabase.removeChannel(profileChannel);
      };
    };

    async function bootstrapUser(userId: string): Promise<void> {
      const generation = ++bootstrapGeneration;
      teardownRealtime();

      const cached = getCachedBootstrap(userId);
      if (cached?.profile) {
        const current = useAuthStore.getState().profile;
        const merged = mergeProfileOnboardingStatus(current, cached.profile) as Profile;
        setProfile(merged);
        beginSessionCreditsWarmup(userId, merged);
        setLoading(false);
      }
      if (cached?.notifications.length) {
        setNotifications(cached.notifications);
      }

      let { profile: coreProfile } = await loadUserProfileCoreDeduped(supabase, userId);

      if (!coreProfile && typeof fetch !== "undefined") {
        try {
          const res = await fetch("/api/profile/ensure", {
            method: "POST",
            credentials: "include",
          });
          if (res.ok) {
            const payload = (await res.json()) as { profile?: Partial<Profile> };
            if (payload.profile) coreProfile = payload.profile;
          }
        } catch {
          /* ignore — user may retry on refresh */
        }
        if (!coreProfile) {
          const retry = await loadUserProfileCoreDeduped(supabase, userId);
          coreProfile = retry.profile;
        }
      }

      if (coreProfile) {
        const current = useAuthStore.getState().profile;
        const profile = mergeProfileOnboardingStatus(current, coreProfile) as Profile;
        setProfile(profile);
        beginSessionCreditsWarmup(userId, profile);
        setCachedBootstrap(userId, {
          profile,
          notifications: cached?.notifications ?? [],
        });
      }

      void (async () => {
        if (coreProfile) {
          try {
            await fetch("/api/notifications/welcome", {
              method: "POST",
              credentials: "include",
            });
          } catch {
            /* welcome is best-effort */
          }
        }

        await refreshUserNotificationsFromApi();
        const visible = useNotificationsStore.getState().notifications;

        if (coreProfile && visible.length >= 0) {
          setCachedBootstrap(userId, {
            profile: coreProfile as Profile,
            notifications: visible as Notification[],
          });
        }
      })();

      if (generation !== bootstrapGeneration) return;
      attachRealtime(userId);
    }

    let disposed = false;
    const authTimeout = window.setTimeout(() => {
      if (!disposed) setLoading(false);
    }, 2_500);

    void supabase.auth.getUser().then(async ({ data: { user: liveUser } }) => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(liveUser ?? null);

      const persisted = useAuthStore.getState().profile;
      if (isStalePersistedProfile(session, persisted, liveUser)) {
        setProfile(null);
      }

      if (liveUser) {
        if (persisted && persisted.id !== liveUser.id) {
          setProfile(null);
        }
        beginSessionCreditsWarmup(liveUser.id, useAuthStore.getState().profile);
        setLoading(false);
        void bootstrapUser(liveUser.id);
      } else {
        setProfile(null);
        try {
          await useAuthStore.persist.clearStorage();
        } catch {
          /* ignore */
        }
        setLoading(false);
      }

      window.clearTimeout(authTimeout);
    }).catch(() => {
      setLoading(false);
      window.clearTimeout(authTimeout);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (event === "SIGNED_IN" && session?.user) {
        teardownRealtime();
        beginSessionCreditsWarmup(session.user.id, useAuthStore.getState().profile);
        setLoading(false);
        void bootstrapUser(session.user.id);
        router.refresh();
      }

      if (event === "SIGNED_OUT") {
        invalidateBootstrapCache();
        bootstrapGeneration += 1;
        teardownRealtime();
        try {
          void useAuthStore.persist.clearStorage();
        } catch { /* ignore */ }
        try {
          const keys = Object.keys(localStorage).filter(
            (k) =>
              k.startsWith("sb-") ||
              k === "dreamos-auth" ||
              k === "supabase.auth.token",
          );
          keys.forEach((k) => localStorage.removeItem(k));
          sessionStorage.clear();
        } catch { /* ignore in SSR */ }
        resetAuth();
        resetCredits();
        resetCreditsBootstrap();
        resetSessionCreditsWarmup();
        resetNotifications();
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth")) {
          router.push("/auth/login");
        }
      }

      if (event === "TOKEN_REFRESHED" && session?.user) {
        void useCreditsStore.getState().syncFromDB({ reason: "manual", force: false });
      }

      if (event === "TOKEN_REFRESHED" && session?.user) {
        setUser(session.user);
        void supabase.auth.getUser().then(({ data: { user: u }, error }) => {
          if (error || !u) return;
          setUser(u);
        });
      }

      if (event === "INITIAL_SESSION" && !session?.user) {
        const persisted = useAuthStore.getState().profile;
        if (isStalePersistedProfile(session, persisted, null)) {
          setProfile(null);
        }
      }
    });

    return () => {
      disposed = true;
      bootstrapGeneration += 1;
      window.clearTimeout(authTimeout);
      teardownRealtime();
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightweightPublic]);

  return (
    <>
      <ReferralCapture />
      <AuthStateDebug />
      {children}
    </>
  );
}
