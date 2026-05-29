import { isLocalhostOrigin } from "@/lib/url/app-origin";

export type AuthCookieOptions = {
  path: string;
  maxAge?: number;
  sameSite: "lax" | "strict" | "none";
  secure: boolean;
  domain?: string;
  httpOnly?: boolean;
};

type OriginInput =
  | string
  | URL
  | Request
  | { url: string }
  | { nextUrl: { origin: string; protocol: string } };

function originFromInput(input?: OriginInput): string {
  if (!input) {
    if (typeof window !== "undefined") {
      return window.location.origin.replace(/\/$/, "");
    }
    return "http://localhost:3000";
  }

  if (typeof input === "string") {
    const trimmed = input.trim().replace(/\/$/, "");
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return new URL(trimmed).origin;
    }
    return trimmed;
  }

  if (input instanceof URL) return input.origin.replace(/\/$/, "");

  if (input instanceof Request) {
    return new URL(input.url).origin.replace(/\/$/, "");
  }

  if ("nextUrl" in input && input.nextUrl) {
    return input.nextUrl.origin.replace(/\/$/, "");
  }

  if ("url" in input && input.url) {
    return new URL(input.url).origin.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}

/**
 * Origin-safe cookie options for OAuth prep, referral, and returnTo cookies.
 * Never sets domain=dreamos86.com on localhost; never Secure on http://localhost.
 */
export function getAuthCookieOptions(originOrRequest?: OriginInput): AuthCookieOptions {
  const origin = originFromInput(originOrRequest);
  const url = new URL(origin);
  const local = isLocalhostOrigin(origin);
  const https = url.protocol === "https:";

  return {
    path: "/",
    sameSite: "lax",
    secure: !local && https,
    // Host-only cookies — no cross-subdomain domain attribute
  };
}

/** Serialize options for document.cookie (client-side ephemeral state). */
export function formatAuthCookieDirective(
  options: AuthCookieOptions,
  maxAgeSeconds = 3600,
): string {
  const parts = [
    `Path=${options.path}`,
    `Max-Age=${options.maxAge ?? maxAgeSeconds}`,
    `SameSite=${options.sameSite === "none" ? "None" : options.sameSite === "strict" ? "Strict" : "Lax"}`,
  ];
  if (options.secure) parts.push("Secure");
  if (options.domain) parts.push(`Domain=${options.domain}`);
  return parts.join("; ");
}

export function applyAuthCookieOptions(
  base: Record<string, unknown>,
  originOrRequest?: OriginInput,
  maxAgeSeconds = 3600,
): Record<string, unknown> {
  const opts = getAuthCookieOptions(originOrRequest);
  return {
    ...base,
    path: opts.path,
    sameSite: opts.sameSite,
    secure: opts.secure,
    ...(opts.domain ? { domain: opts.domain } : {}),
    maxAge: maxAgeSeconds,
  };
}
