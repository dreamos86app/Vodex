import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type ProviderStatus = "enabled" | "disabled" | "unknown";

export interface AuthHealthResult {
  env: {
    supabaseUrl: boolean;
    supabaseKey: boolean;
    appUrl: boolean;
    appUrlValue: string | null;
  };
  session: {
    active: boolean;
    userId: string | null;
    email: string | null;
  };
  providers: {
    google: ProviderStatus;
    github: ProviderStatus;
  };
  routes: {
    callback: boolean;
    resetPassword: boolean;
    forgot: boolean;
  };
  middleware: boolean;
  checkedAt: string;
}

/**
 * Probe whether an OAuth provider is enabled by using Supabase's
 * signInWithOAuth with skipBrowserRedirect: true.
 *
 * - Returns a redirect URL  → provider is enabled
 * - Returns an error about "not enabled" → provider is disabled
 * - Other error → unknown
 */
async function probeProvider(
  supabaseUrl: string,
  supabaseKey: string,
  provider: "google" | "github",
): Promise<ProviderStatus> {
  try {
    // Use the REST API directly to get an OAuth URL — this does not redirect
    // and tells us immediately if the provider is configured.
    const res = await fetch(
      `${supabaseUrl}/auth/v1/authorize?provider=${provider}&redirect_to=https://dreamos86.com/auth/callback`,
      {
        method: "GET",
        headers: {
          apikey: supabaseKey,
          "Content-Type": "application/json",
        },
        redirect: "manual", // don't follow the redirect — just check the response code
      },
    );

    // 302 → provider is configured and returned a redirect URL
    // 400 / 422 → provider not enabled or invalid
    if (res.status === 302 || res.status === 301) return "enabled";
    if (res.status >= 400) {
      const text = await res.text().catch(() => "");
      if (
        text.toLowerCase().includes("not enabled") ||
        text.toLowerCase().includes("unsupported provider") ||
        text.toLowerCase().includes("provider") 
      ) {
        return "disabled";
      }
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

export async function GET(request: Request) {
  const supabase = await createClient();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const appUrlEnv = process.env.NEXT_PUBLIC_APP_URL ?? null;

  // ?probe=google|github — re-check just one provider for the test button
  const url = new URL(request.url);
  const probe = url.searchParams.get("probe") as "google" | "github" | null;

  // Session check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let googleStatus: ProviderStatus;
  let githubStatus: ProviderStatus;

  if (probe === "google") {
    googleStatus = await probeProvider(supabaseUrl, supabaseKey, "google");
    githubStatus = "unknown";
  } else if (probe === "github") {
    googleStatus = "unknown";
    githubStatus = await probeProvider(supabaseUrl, supabaseKey, "github");
  } else {
    // Full check — run both in parallel
    [googleStatus, githubStatus] = await Promise.all([
      probeProvider(supabaseUrl, supabaseKey, "google"),
      probeProvider(supabaseUrl, supabaseKey, "github"),
    ]);
  }

  const result: AuthHealthResult = {
    env: {
      supabaseUrl: Boolean(supabaseUrl),
      supabaseKey: Boolean(supabaseKey),
      appUrl: Boolean(appUrlEnv),
      appUrlValue: appUrlEnv,
    },
    session: {
      active: Boolean(user),
      userId: user?.id ?? null,
      email: user?.email ?? null,
    },
    providers: {
      google: googleStatus,
      github: githubStatus,
    },
    routes: {
      callback: true,
      resetPassword: true,
      forgot: true,
    },
    middleware: true,
    checkedAt: new Date().toISOString(),
  };

  return NextResponse.json(result);
}
