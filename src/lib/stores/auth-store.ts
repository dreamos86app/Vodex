/**
 * DreamOS86 — Auth Store
 * Global auth state synced with Supabase session.
 *
 * IMPORTANT: persist runs with `skipHydration: true` so the first client
 * render matches the SSR snapshot (profile: null, loading: true). The
 * AppProvider calls `useAuthStore.persist.rehydrate()` from inside an
 * effect, after mount. This eliminates the hydration-mismatch class of
 * white-screens caused by reading localStorage during the first paint.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, Session } from "@supabase/supabase-js";
import type { Profile } from "@/lib/supabase/types";

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;

  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      session: null,
      profile: null,
      loading: true,

      setUser: (user) => set({ user }),
      setSession: (session) => set({ session }),
      setProfile: (profile) => set({ profile }),
      setLoading: (loading) => set({ loading }),
      reset: () =>
        set({ user: null, session: null, profile: null, loading: false }),
    }),
    {
      name: "dreamos-auth",
      partialize: (state) => ({ profile: state.profile }),
      skipHydration: true,
    },
  ),
);
