import "server-only";

import { isVodexSupabaseAuthDomainReady } from "@/lib/supabase/auth-domain";
import { getCentralOAuthOrigin, useCentralPublishedOAuth } from "@/lib/publish/central-oauth-config";

export type PublishedAuthClientConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  authDomainReady: boolean;
  callbackUrl: string;
  authBasePath: string;
  slug: string;
  centralOAuthOrigin: string | null;
};

/** Base path for auth routes (/p/slug or '' on subdomain root). */
export function publishedAuthBasePath(publicUrl: string, slug: string): string {
  try {
    const u = new URL(publicUrl);
    if (u.pathname.includes(`/p/${slug}`) || u.pathname.startsWith("/p/")) {
      return `/p/${slug}`;
    }
    return "";
  } catch {
    return `/p/${slug}`;
  }
}

export function publishedAuthCallbackUrl(publicUrl: string, slug: string): string {
  const base = publishedAuthBasePath(publicUrl, slug);
  try {
    const u = new URL(publicUrl);
    const path = base ? `${base}/auth/callback` : "/auth/callback";
    return `${u.origin}${path}`;
  } catch {
    return `/p/${slug}/auth/callback`;
  }
}

export function resolvePublishedAuthClientConfig(
  slug: string,
  publicUrl: string,
): PublishedAuthClientConfig | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseAnonKey) return null;

  return {
    supabaseUrl,
    supabaseAnonKey,
    authDomainReady: isVodexSupabaseAuthDomainReady(),
    callbackUrl: publishedAuthCallbackUrl(publicUrl, slug),
    authBasePath: publishedAuthBasePath(publicUrl, slug),
    slug,
    centralOAuthOrigin: useCentralPublishedOAuth() ? getCentralOAuthOrigin() : null,
  };
}

export function vodexManagedAuthConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}
