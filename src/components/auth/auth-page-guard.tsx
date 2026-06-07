"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeAuthReturnPath } from "@/lib/auth/oauth-prep";
import { markRedirectToNextAfterValidSession } from "@/lib/auth/auth-session-state";

function safeNextPath(raw: string | null): string {
  return safeAuthReturnPath(raw) ?? "/create";
}

/** Redirect signed-in users away from login/signup without signing them out. */
export function AuthPageGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    const failOpen = window.setTimeout(() => {
      if (!cancelled) setReady(true);
    }, 900);

    void (async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (cancelled) return;

        if (error || !user) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session && !user) {
            await supabase.auth.signOut({ scope: "local" });
          }
        } else {
          const dest = safeNextPath(searchParams.get("next"));
          markRedirectToNextAfterValidSession(dest);
          router.replace(dest);
        }
      } catch {
        /* show login — user can retry */
      } finally {
        window.clearTimeout(failOpen);
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(failOpen);
    };
  }, [router, searchParams]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="size-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
