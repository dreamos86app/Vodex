"use client";

/**
 * DreamOS86 — App Provider
 * Bootstraps Supabase auth listener, syncs to Zustand stores,
 * and wires up realtime subscriptions.
 *
 * Client-only: Supabase browser client is created inside useEffect so static
 * prerender (no public env vars) does not instantiate @supabase/ssr.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useCreditsStore } from "@/lib/stores/credits-store";
import { useNotificationsStore } from "@/lib/stores/notifications-store";
import type { Notification } from "@/lib/supabase/types";
import { ReferralCapture } from "@/components/referrals/referral-capture";
import { CommandCenter } from "@/components/command/command-center";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { setUser, setSession, setProfile, setLoading, reset: resetAuth } =
    useAuthStore();
  const { syncFromDB: syncCredits, reset: resetCredits } = useCreditsStore();
  const { setNotifications, addNotification, reset: resetNotifications } =
    useNotificationsStore();

  // Rehydrate persisted Zustand state AFTER mount. The store is created
  // with `skipHydration: true` so SSR and first client paint match. We
  // trigger rehydration here, then bootstrap the live session below.
  React.useEffect(() => {
    void useAuthStore.persist.rehydrate();
  }, []);

  React.useEffect(() => {
    const supabase = createClient();

    async function bootstrapUser(userId: string): Promise<() => void> {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profile) {
        setProfile(profile);
        useCreditsStore.getState().setCredits(
          profile.credits_remaining,
          profile.credits_reset_at,
        );
      }

      const { data: notifications } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (notifications) {
        setNotifications(notifications as Notification[]);
      }

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
            addNotification(payload.new as Notification);
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
            const p = payload.new as {
              credits_remaining: number;
              credits_reset_at: string;
            };
            useCreditsStore
              .getState()
              .setCredits(p.credits_remaining, p.credits_reset_at);
            setProfile({
              ...useAuthStore.getState().profile!,
              ...payload.new,
            });
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(notificationsChannel);
        supabase.removeChannel(profileChannel);
      };
    }

    let disposeRealtime: (() => void) | undefined;

    void supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        void bootstrapUser(session.user.id).then((dispose) => {
          disposeRealtime = dispose;
        });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (event === "SIGNED_IN" && session?.user) {
        disposeRealtime?.();
        disposeRealtime = await bootstrapUser(session.user.id);
        router.refresh();
      }

      if (event === "SIGNED_OUT") {
        disposeRealtime?.();
        disposeRealtime = undefined;
        resetAuth();
        resetCredits();
        resetNotifications();
        router.push("/auth/login");
      }

      if (event === "TOKEN_REFRESHED" && session?.user) {
        syncCredits(session.user.id);
      }
    });

    return () => {
      disposeRealtime?.();
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <ReferralCapture />
      <CommandCenter />
      {children}
    </>
  );
}
