"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import { isOnboardingExemptPath } from "@/lib/onboarding/exempt-paths";
import { isE2eCreditTestAccount } from "@/lib/credits/e2e-credit-account";

/**
 * Blocks (app) shell children until onboarding status is known.
 * Prevents dashboard flash and fake workspace labels before redirect.
 */
export function OnboardingAppGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const loading = useAuthStore((s) => s.loading);
  const profile = useAuthStore((s) => s.profile);
  const user = useAuthStore((s) => s.user);

  const needsGate = Boolean(pathname && !pathname.startsWith("/onboarding"));
  const incomplete = profile?.onboarding_completed !== true;
  const exempt = isOnboardingExemptPath(pathname);
  const e2e = isE2eCreditTestAccount(profile?.email ?? user?.email);

  React.useEffect(() => {
    if (loading || !needsGate || !profile?.id || e2e) return;
    if (!incomplete || exempt) return;
    router.replace(`/onboarding?next=${encodeURIComponent(pathname ?? "/projects")}`);
  }, [loading, needsGate, profile?.id, incomplete, exempt, e2e, pathname, router]);

  if (!needsGate) return <>{children}</>;

  if (loading || (user && !profile?.id)) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="size-6 animate-spin text-accent" strokeWidth={1.6} />
        <p className="text-[13px]">Loading your workspace…</p>
      </div>
    );
  }

  if (incomplete && !exempt && !e2e) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="size-6 animate-spin text-accent" strokeWidth={1.6} />
        <p className="text-[13px]">Continuing to onboarding…</p>
      </div>
    );
  }

  return <>{children}</>;
}
