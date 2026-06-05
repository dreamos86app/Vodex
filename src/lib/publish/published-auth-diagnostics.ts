import "server-only";

import {
  getSupabaseAuthCallbackUrl,
  getSupabasePublicUrl,
  isVodexSupabaseAuthDomainReady,
  usesDefaultSupabaseProjectHost,
} from "@/lib/supabase/auth-domain";
import {
  publishedAuthCallbackUrl,
  publishedAuthBasePath,
  vodexManagedAuthConfigured,
} from "@/lib/publish/published-auth-config";
import {
  getCentralOAuthCallbackUrl,
  useCentralPublishedOAuth,
} from "@/lib/publish/central-oauth-config";
import {
  parseCustomOAuthVault,
  publicCustomOAuthStatus,
  validateCustomOAuthEnable,
} from "@/lib/publish/custom-oauth-store";

export type AuthDiagnosticCheck = {
  id: string;
  label: string;
  status: "ok" | "warn" | "error";
  detail: string;
};

export type PublishedAuthDiagnostics = {
  checks: AuthDiagnosticCheck[];
  ready: boolean;
  oauthMode: "vodex_managed" | "custom";
  supabaseUrl: string | null;
  supabaseAnonKeyDetected: boolean;
  serviceRoleDetected: boolean;
  authDomainReady: boolean;
  publishedSlug: string | null;
  publishedAppCallbackUrl: string | null;
  centralOAuthCallbackUrl: string | null;
  centralOAuthRecommended: boolean;
  publishedLoginUrl: string | null;
  supabaseAuthCallbackUrl: string | null;
  googleEnabled: boolean;
  githubEnabled: boolean;
  appleEnabled: boolean;
  lastAuthError: string | null;
  lastAuthErrorAt: string | null;
  customOAuth: ReturnType<typeof publicCustomOAuthStatus>;
  redirectUrlHints: string[];
};

export async function buildPublishedAuthDiagnostics(input: {
  projectId: string;
  publicUrl?: string | null;
  slug?: string | null;
  authSettings?: Record<string, unknown> | null;
}): Promise<PublishedAuthDiagnostics> {
  const checks: AuthDiagnosticCheck[] = [];
  const supabaseUrl = getSupabasePublicUrl();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const authDomainReady = isVodexSupabaseAuthDomainReady();
  const slug = input.slug?.trim() || null;
  const publicUrl = input.publicUrl?.trim() || null;

  const settings = input.authSettings ?? {};
  const oauthMode = settings.oauth_mode === "custom" ? "custom" : "vodex_managed";
  const googleEnabled = settings.google_enabled === true;
  const githubEnabled = settings.github_enabled === true;
  const appleEnabled = settings.apple_enabled === true;
  const vault = parseCustomOAuthVault(settings.custom_oauth);

  if (supabaseUrl) {
    checks.push({ id: "supabase_url", label: "Supabase URL", status: "ok", detail: supabaseUrl });
  } else {
    checks.push({
      id: "supabase_url",
      label: "Supabase URL",
      status: "error",
      detail: "NEXT_PUBLIC_SUPABASE_URL is missing.",
    });
  }

  if (anonKey) {
    checks.push({ id: "anon_key", label: "Anon key", status: "ok", detail: "Detected (not shown)" });
  } else {
    checks.push({
      id: "anon_key",
      label: "Anon key",
      status: "error",
      detail: "NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.",
    });
  }

  if (serviceRole) {
    checks.push({ id: "service_role", label: "Service role", status: "ok", detail: "Server-only (not exposed)" });
  } else {
    checks.push({
      id: "service_role",
      label: "Service role",
      status: "warn",
      detail: "SUPABASE_SERVICE_ROLE_KEY missing — user sync may fail.",
    });
  }

  if (authDomainReady && !usesDefaultSupabaseProjectHost()) {
    checks.push({ id: "auth_domain", label: "Auth domain", status: "ok", detail: "Vodex auth domain active" });
  } else if (authDomainReady) {
    checks.push({
      id: "auth_domain",
      label: "Auth domain",
      status: "warn",
      detail: "VODEX_SUPABASE_AUTH_DOMAIN_READY=true but URL still uses default host.",
    });
  } else {
    checks.push({
      id: "auth_domain",
      label: "Auth domain",
      status: "warn",
      detail: "auth.vodex.dev not marked active — Google may show Supabase project URL.",
    });
  }

  if (slug && publicUrl) {
    checks.push({ id: "published_slug", label: "Published slug", status: "ok", detail: slug });
  } else {
    checks.push({
      id: "published_slug",
      label: "Published slug",
      status: "error",
      detail: "App is not published — publish to get auth URLs.",
    });
  }

  const publishedAppCallbackUrl =
    slug && publicUrl ? publishedAuthCallbackUrl(publicUrl, slug) : null;
  const centralOAuthCallbackUrl = useCentralPublishedOAuth() ? getCentralOAuthCallbackUrl() : null;
  const centralOAuthRecommended = useCentralPublishedOAuth();
  const publishedLoginUrl =
    slug && publicUrl
      ? `${publicUrl.replace(/\/$/, "")}${publishedAuthBasePath(publicUrl, slug)}/login`.replace(/([^:]\/)\/+/g, "$1")
      : slug
        ? `/p/${slug}/login`
        : null;
  const supabaseAuthCallbackUrl = getSupabaseAuthCallbackUrl();

  const redirectUrlHints: string[] = [];
  if (centralOAuthCallbackUrl) {
    redirectUrlHints.push(centralOAuthCallbackUrl);
    redirectUrlHints.push("Configure this single URL in Supabase + Google — scales to all apps.");
  }
  if (publishedAppCallbackUrl) redirectUrlHints.push(`Legacy fallback: ${publishedAppCallbackUrl}`);
  if (publishedLoginUrl) redirectUrlHints.push(publishedLoginUrl);

  if (centralOAuthCallbackUrl) {
    checks.push({
      id: "central_callback",
      label: "Central OAuth callback",
      status: "ok",
      detail: `${centralOAuthCallbackUrl} — recommended for all published apps.`,
    });
  }

  if (publishedAppCallbackUrl) {
    checks.push({
      id: "app_callback",
      label: "Legacy app callback",
      status: "warn",
      detail: `${publishedAppCallbackUrl} — fallback only; per-app URLs do not scale.`,
    });
  }

  if (!googleEnabled && !githubEnabled && !settings.email_password_enabled) {
    checks.push({
      id: "providers",
      label: "Providers",
      status: "warn",
      detail: "No sign-in methods enabled.",
    });
  }

  if (oauthMode === "custom") {
    const customCheck = validateCustomOAuthEnable({
      vault,
      google_enabled: googleEnabled,
      github_enabled: githubEnabled,
      apple_enabled: appleEnabled,
    });
    if (customCheck.ok) {
      checks.push({
        id: "custom_oauth",
        label: "Custom OAuth",
        status: "ok",
        detail: "Credentials stored — also add matching values in Supabase Auth providers.",
      });
    } else {
      checks.push({
        id: "custom_oauth",
        label: "Custom OAuth",
        status: "error",
        detail: customCheck.errors.join(" "),
      });
    }
  } else if (!vodexManagedAuthConfigured()) {
    checks.push({
      id: "vodex_managed",
      label: "Vodex-managed auth",
      status: "error",
      detail: "Platform Supabase env is not configured.",
    });
  } else {
    checks.push({
      id: "vodex_managed",
      label: "Vodex-managed auth",
      status: "ok",
      detail: "Using platform Supabase Auth.",
    });
  }

  if (googleEnabled && oauthMode === "vodex_managed") {
    checks.push({
      id: "google_provider",
      label: "Google",
      status: "warn",
      detail: "Enable Google in Supabase Auth and add redirect URLs listed below.",
    });
  }

  const lastAuthError =
    typeof settings.last_auth_error === "string" ? settings.last_auth_error : null;
  const lastAuthErrorAt =
    typeof settings.last_auth_error_at === "string" ? settings.last_auth_error_at : null;

  if (lastAuthError) {
    checks.push({
      id: "last_error",
      label: "Last auth error",
      status: "error",
      detail: lastAuthError,
    });
  }

  const ready =
    checks.every((c) => c.status !== "error") &&
    Boolean(slug) &&
    Boolean(anonKey) &&
    Boolean(supabaseUrl) &&
    (oauthMode === "vodex_managed" ? vodexManagedAuthConfigured() : validateCustomOAuthEnable({
      vault,
      google_enabled: googleEnabled,
      github_enabled: githubEnabled,
      apple_enabled: appleEnabled,
    }).ok);

  return {
    checks,
    ready,
    oauthMode,
    supabaseUrl,
    supabaseAnonKeyDetected: Boolean(anonKey),
    serviceRoleDetected: Boolean(serviceRole),
    authDomainReady,
    publishedSlug: slug,
    publishedAppCallbackUrl,
    centralOAuthCallbackUrl,
    centralOAuthRecommended,
    publishedLoginUrl,
    supabaseAuthCallbackUrl,
    googleEnabled,
    githubEnabled,
    appleEnabled,
    lastAuthError,
    lastAuthErrorAt,
    customOAuth: publicCustomOAuthStatus(vault),
    redirectUrlHints,
  };
}

export function isPublishedAuthRuntimeReady(settings: {
  oauth_mode?: string;
  google_enabled?: boolean;
  github_enabled?: boolean;
  apple_enabled?: boolean;
  custom_oauth?: unknown;
}): boolean {
  if (!vodexManagedAuthConfigured()) return false;
  if (settings.oauth_mode === "custom") {
    const vault = parseCustomOAuthVault(settings.custom_oauth);
    return validateCustomOAuthEnable({
      vault,
      google_enabled: settings.google_enabled === true,
      github_enabled: settings.github_enabled === true,
      apple_enabled: settings.apple_enabled === true,
    }).ok;
  }
  return true;
}

export async function recordPublishedAuthError(
  projectId: string,
  message: string,
): Promise<void> {
  const admin = (await import("@/lib/supabase/admin")).createServiceRoleClient();
  if (!admin) return;
  await admin
    .from("app_auth_provider_settings" as never)
    .update({
      last_auth_error: message.slice(0, 500),
      last_auth_error_at: new Date().toISOString(),
    } as never)
    .eq("project_id", projectId);
}

export async function clearPublishedAuthError(projectId: string): Promise<void> {
  const admin = (await import("@/lib/supabase/admin")).createServiceRoleClient();
  if (!admin) return;
  await admin
    .from("app_auth_provider_settings" as never)
    .update({
      last_auth_error: null,
      last_auth_error_at: null,
    } as never)
    .eq("project_id", projectId);
}
