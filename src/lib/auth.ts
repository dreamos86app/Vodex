/**
 * DreamOS86 — Centralized Auth Service
 *
 * Single source of truth for every auth operation.
 * OAuth redirect URLs use live browser origin in the client.
 */

import { createClient } from "@/lib/supabase/client";
import { getAppUrl } from "@/lib/app-url";
import { CONNECTION_SETUP_USER_MESSAGE } from "@/lib/network/ssl-diagnostics-store";
import {
  getCallbackUrl as buildCallbackUrl,
  getCanonicalOAuthCallbackUrl,
  getPasswordResetUrl as buildPasswordResetUrl,
} from "@/lib/auth/oauth-redirect";
import { prepareClientOAuthSignIn } from "@/lib/auth/oauth-prep";

export { getAppUrl } from "@/lib/app-url";
export {
  getCallbackUrl,
  getCanonicalOAuthCallbackUrl,
  getPasswordResetUrl,
  getOAuthBaseUrl,
} from "@/lib/auth/oauth-redirect";
export {
  safeAuthReturnPath,
  prepareClientOAuthSignIn,
  captureReferralFromLocationSearch,
} from "@/lib/auth/oauth-prep";

export async function authSignIn(email: string, password: string) {
  return createClient().auth.signInWithPassword({ email, password });
}

export async function authSignUp(
  email: string,
  password: string,
  fullName: string,
) {
  return createClient().auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: getCanonicalOAuthCallbackUrl(),
    },
  });
}

export type OAuthSignInOptions = {
  /** Relative in-app path only (e.g. /create). Referral codes use cookies, not redirectTo. */
  returnTo?: string | null;
};

export async function authSignInWithOAuth(
  provider: "google" | "github",
  options?: OAuthSignInOptions | string | null,
) {
  const client = createClient();
  const returnTo =
    typeof options === "string" ? options : (options?.returnTo ?? null);
  const { redirectTo } = prepareClientOAuthSignIn(returnTo, provider);

  if (provider === "google") {
    return client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          prompt: "select_account",
          access_type: "offline",
        },
      },
    });
  }

  return client.auth.signInWithOAuth({
    provider,
    options: { redirectTo },
  });
}

export async function authSignOut() {
  return createClient().auth.signOut();
}

export async function authResetPasswordForEmail(email: string) {
  return createClient().auth.resetPasswordForEmail(email, {
    redirectTo: buildPasswordResetUrl(),
  });
}

export async function authUpdatePassword(password: string) {
  return createClient().auth.updateUser({ password });
}

export type LoginErrorKind =
  | "wrong_password"
  | "no_account"
  | "invalid_email"
  | "email_not_confirmed"
  | "rate_limit"
  | "network"
  | "generic";

const SIGNUP_EXISTS_RE =
  /user already registered|already been registered|user_already_exists|email_exists|already exists|duplicate user|email address is already|signups not allowed.*exist/i;

export function isSignupExistingUserError(message: string): boolean {
  return SIGNUP_EXISTS_RE.test(message);
}

export function isSignupDuplicateWithoutError(
  user: { identities?: unknown[] } | null | undefined,
): boolean {
  return Boolean(user && Array.isArray(user.identities) && user.identities.length === 0);
}

const OAUTH_EXISTS_RE =
  /identity.*already|already.*linked|user already registered|email.*already.*registered|account.*already.*exists|signup.*not allowed.*exist/i;

const ERROR_MAP: Array<[RegExp, string]> = [
  [
    /invalid login credentials|invalid_credentials/i,
    "__LOGIN_INVALID__",
  ],
  [
    OAUTH_EXISTS_RE,
    "This account already exists. Please log in with the same method.",
  ],
  [
    /email not confirmed/i,
    "Please verify your email before signing in. Check your inbox.",
  ],
  [
    SIGNUP_EXISTS_RE,
    "Account already exists. Log in with this email instead.",
  ],
  [
    /password should be at least|password must be/i,
    "Password must be at least 8 characters.",
  ],
  [/rate.?limit|too many/i, "Too many attempts. Please wait and try again."],
  [
    /unable to verify|certificate|UNABLE_TO_VERIFY|SELF_SIGNED_CERT/i,
    "__CONNECTION_SETUP__",
  ],
  [
    /network|failed to fetch|load failed|fetch failed/i,
    "__CONNECTION_SETUP__",
  ],
  [
    /token.*expired|link.*expired|expired.*token|otp_expired/i,
    "This link has expired. Please request a new one.",
  ],
  [
    /token.*used|already.*used/i,
    "This link has already been used. Please request a new one.",
  ],
  [
    /provider.*not enabled|not.*enabled.*provider|unsupported provider|provider is not/i,
    "__PROVIDER_OFF__",
  ],
  [/signup.*disabled|signups.*disabled/i, "Account registration is currently disabled."],
  [/email.*invalid|invalid.*email/i, "Please enter a valid email address."],
];

export function humanizeLoginError(
  message: string,
  options?: { emailRegistered?: boolean },
): { message: string; kind: LoginErrorKind } {
  const raw = message.replace(/^\[.*?\]\s*/, "").replace(/\s+/g, " ").trim();

  if (/email.*invalid|invalid.*email/i.test(raw)) {
    return { message: "Enter a valid email address.", kind: "invalid_email" };
  }
  if (/email not confirmed/i.test(raw)) {
    return {
      message: "Please verify your email before signing in. Check your inbox.",
      kind: "email_not_confirmed",
    };
  }
  if (/rate.?limit|too many/i.test(raw)) {
    return { message: "Too many attempts. Please wait and try again.", kind: "rate_limit" };
  }
  if (/unable to verify|certificate|UNABLE_TO_VERIFY|SELF_SIGNED_CERT|fetch failed/i.test(raw)) {
    return { message: CONNECTION_SETUP_USER_MESSAGE, kind: "network" };
  }
  if (/network|failed to fetch|load failed/i.test(raw)) {
    return { message: CONNECTION_SETUP_USER_MESSAGE, kind: "network" };
  }
  if (/invalid login credentials|invalid_credentials/i.test(raw)) {
    if (options?.emailRegistered === false) {
      return {
        message: "No account found with this email. Create an account instead.",
        kind: "no_account",
      };
    }
    if (options?.emailRegistered === true) {
      return {
        message: "Email or password is incorrect.",
        kind: "wrong_password",
      };
    }
    return {
      message: "Email or password is incorrect.",
      kind: "wrong_password",
    };
  }

  return { message: humanizeAuthError(raw), kind: "generic" };
}

export function humanizeAuthError(
  message: string,
  provider?: "google" | "github",
): string {
  for (const [pattern, replacement] of ERROR_MAP) {
    if (pattern.test(message)) {
      if (replacement === "__LOGIN_INVALID__") {
        return "Email or password is incorrect.";
      }
      if (replacement === "__PROVIDER_OFF__") {
        const name =
          provider === "google"
            ? "Google"
            : provider === "github"
              ? "GitHub"
              : "OAuth";
        return `${name} sign-in failed (unsupported provider). Check Supabase Auth URL config includes ${getCanonicalOAuthCallbackUrl()} and matches this origin.`;
      }
      if (replacement === "__CONNECTION_SETUP__") {
        return CONNECTION_SETUP_USER_MESSAGE;
      }
      return replacement;
    }
  }
  return message.replace(/^\[.*?\]\s*/, "").replace(/\s+/g, " ").trim();
}

export const CALLBACK_ERROR_MESSAGES: Record<string, string> = {
  callback_failed:
    "Sign-in could not be completed. Try again, or use email and password.",
  session_exchange_failed:
    "Your sign-in link has expired or was already used. Please sign in again.",
  missing_code: "Invalid sign-in link — no authorization code was received.",
  provider_not_enabled:
    "That sign-in method is not available. Please use email and password.",
  access_denied: "Sign-in was cancelled.",
  server_error: "The sign-in provider returned an error. Please try again.",
  profile_setup_failed:
    "Login succeeded, but workspace setup failed. Please refresh or contact support.",
  auth_redirect_mismatch:
    "Sign-in redirect URL mismatch. Add your app URL and /auth/callback to Supabase Auth redirect URLs.",
  auth_cookie_missing:
    "Sign-in session cookie was missing (often caused by blocked cookies or opening the link in a different browser). Try again in the same browser.",
};

/** Safe provider error_description for display (no tokens/codes). */
export function sanitizeAuthErrorDescription(raw: string | null): string | null {
  if (!raw?.trim()) return null;
  const decoded = decodeURIComponent(raw.replace(/\+/g, " "))
    .replace(/[^\w\s.,!?@\-–—'"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!decoded || decoded.length < 4) return null;
  if (/token|secret|code|bearer|jwt|password/i.test(decoded)) return null;
  return decoded.slice(0, 220);
}

export function humanizeCallbackError(
  slug: string | null,
  errorDescription?: string | null,
): string {
  const safeDesc = sanitizeAuthErrorDescription(errorDescription ?? null);
  if (safeDesc) return safeDesc;
  if (slug && CALLBACK_ERROR_MESSAGES[slug]) {
    return CALLBACK_ERROR_MESSAGES[slug];
  }
  return slug
    ? `Sign-in failed (${slug.replace(/_/g, " ")}). Please try again.`
    : "Sign-in failed. Please try again.";
}

export function callbackErrorSlugFromExchangeMessage(message: string): string {
  const msg = message.toLowerCase();
  if (
    msg.includes("expired") ||
    msg.includes("otp_expired") ||
    msg.includes("already been used") ||
    msg.includes("already used")
  ) {
    return "session_exchange_failed";
  }
  if (
    msg.includes("redirect") ||
    msg.includes("redirect_uri") ||
    msg.includes("url mismatch") ||
    msg.includes("invalid request")
  ) {
    return "auth_redirect_mismatch";
  }
  if (
    msg.includes("code verifier") ||
    msg.includes("pkce") ||
    msg.includes("both auth code and code verifier") ||
    msg.includes("nonces mismatch")
  ) {
    return "auth_cookie_missing";
  }
  if (msg.includes("provider") && msg.includes("not enabled")) {
    return "provider_not_enabled";
  }
  return "callback_failed";
}
