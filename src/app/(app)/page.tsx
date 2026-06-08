import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import dynamic from "next/dynamic";
import { PublicLanding } from "@/components/marketing/public-landing";
import { getServerSessionUser } from "@/lib/auth/session";
import { buildAuthCallbackRedirectFromSearchParams } from "@/lib/auth/oauth-redirect";
import { userNeedsOnboarding } from "@/lib/onboarding/require-onboarding-complete";
import { createClient } from "@/lib/supabase/server";

const OsHome = dynamic(() => import("@/components/os-home/os-home").then((m) => m.OsHome), {
  loading: () => <OsHomeFallback />,
});

export const metadata = {
  title: "Home",
  description: "The AI-native operating system for building software.",
};

function OsHomeFallback() {
  return (
    <div className="flex min-h-[40vh] w-full items-center justify-center text-[13px] text-muted-foreground">
      Loading…
    </div>
  );
}

/**
 * `/` — Logged-in OS home, or public marketing landing when anonymous.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") qs.set(key, value);
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const requestBase = `${proto}://${host}`;
  const oauthRedirect = buildAuthCallbackRedirectFromSearchParams(qs, requestBase);
  if (oauthRedirect) {
    redirect(oauthRedirect);
  }

  const user = await getServerSessionUser();

  if (!user) {
    return <PublicLanding />;
  }

  const supabase = await createClient();
  const needsOnboarding = await userNeedsOnboarding(supabase, user.id);
  if (needsOnboarding) {
    redirect("/onboarding");
  }

  return (
    <Suspense fallback={<OsHomeFallback />}>
      <OsHome />
    </Suspense>
  );
}
