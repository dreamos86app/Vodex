/**
 * Supabase Auth URL / custom domain helpers.
 * OAuth branding in Google uses NEXT_PUBLIC_SUPABASE_URL host until a custom domain is configured.
 */

export function getSupabasePublicUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  return url || null;
}

/** True when still on the default `*.supabase.co` project URL (Google chooser shows project ref). */
export function usesDefaultSupabaseProjectHost(): boolean {
  const url = getSupabasePublicUrl();
  if (!url) return true;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.endsWith(".supabase.co");
  } catch {
    return true;
  }
}

export function getSupabaseProjectRefFromUrl(url: string): string | null {
  const m = url.match(/https?:\/\/([^.]+)\.supabase\.co/i);
  return m?.[1] ?? null;
}

export function getSupabaseAuthCallbackUrl(): string | null {
  const base = getSupabasePublicUrl();
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/auth/v1/callback`;
}
