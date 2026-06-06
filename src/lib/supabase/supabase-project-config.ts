import { DREAMOS_SUPABASE_PROJECT_REF } from "@/lib/supabase/project-ref";

/** Single production Supabase project — must match Google OAuth redirect URI registration. */
export const PRODUCTION_CANONICAL_PROJECT_REF = DREAMOS_SUPABASE_PROJECT_REF;

/**
 * Known project refs (legacy + canonical). Only PRODUCTION_CANONICAL_PROJECT_REF may run in production.
 */
const LEGACY_SUPABASE_PROJECT_REFS = (process.env.LEGACY_SUPABASE_PROJECT_REFS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const ALLOWED_SUPABASE_PROJECT_REFS = [
  PRODUCTION_CANONICAL_PROJECT_REF,
  ...LEGACY_SUPABASE_PROJECT_REFS,
] as const;

export type AllowedSupabaseProjectRef = (typeof ALLOWED_SUPABASE_PROJECT_REFS)[number];

export function isAllowedSupabaseProjectRef(ref: string | null | undefined): ref is AllowedSupabaseProjectRef {
  if (!ref) return false;
  return (ALLOWED_SUPABASE_PROJECT_REFS as readonly string[]).includes(ref);
}

export function expectedGoogleOAuthRedirectUri(projectRef: string): string {
  return `https://${projectRef}.supabase.co/auth/v1/callback`;
}

export function extractSupabaseProjectRefFromUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const host = new URL(url.trim()).hostname;
    const m = host.match(/^([a-z0-9]+)\.supabase\.co$/i);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Resolve project ref from URL or anon/service JWT when using a Supabase custom domain. */
export function resolveSupabaseProjectRef(input?: {
  url?: string | null;
  anonKey?: string | null;
  serviceKey?: string | null;
}): string | null {
  const fromUrl = extractSupabaseProjectRefFromUrl(input?.url ?? process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (fromUrl) return fromUrl;
  const anonKey = input?.anonKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey =
    input?.serviceKey ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY;
  return extractProjectRefFromSupabaseJwt(anonKey) ?? extractProjectRefFromSupabaseJwt(serviceKey);
}

export function isVodexSupabaseCustomDomainUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    return (
      host === "api.vodex.dev" ||
      host === "auth.vodex.dev" ||
      host.endsWith(".vodex.dev") ||
      process.env.VODEX_SUPABASE_AUTH_DOMAIN_READY === "true"
    );
  } catch {
    return false;
  }
}

/** Decode Supabase JWT `ref` claim without verifying signature (config check only). */
export function extractProjectRefFromSupabaseJwt(jwt: string | null | undefined): string | null {
  if (!jwt?.trim()) return null;
  const parts = jwt.trim().split(".");
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = Buffer.from(padded, "base64").toString("utf8");
    const payload = JSON.parse(json) as { ref?: string };
    return typeof payload.ref === "string" ? payload.ref : null;
  } catch {
    return null;
  }
}
