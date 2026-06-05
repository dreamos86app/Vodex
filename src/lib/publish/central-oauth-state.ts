import "server-only";

import { createHmac, randomBytes } from "crypto";

export type PublishedOAuthState = {
  projectId: string;
  publishedAppId: string;
  slug: string;
  returnUrl: string;
  provider: string;
  nonce: string;
};

const COOKIE_NAME = "vodex_pub_oauth_ctx";

function stateSecret(): string {
  return (
    process.env.VODEX_OAUTH_STATE_SECRET?.trim() ??
    process.env.GITHUB_OAUTH_STATE_SECRET?.trim() ??
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    "dev-vodex-oauth-state"
  );
}

function signPayload(raw: string): string {
  return createHmac("sha256", stateSecret()).update(raw).digest("hex").slice(0, 20);
}

export function buildPublishedOAuthState(input: Omit<PublishedOAuthState, "nonce">): string {
  const nonce = randomBytes(10).toString("hex");
  const raw = [
    "pub",
    input.projectId,
    input.publishedAppId,
    input.slug,
    encodeURIComponent(input.returnUrl),
    input.provider,
    nonce,
  ].join(":");
  const payload = Buffer.from(raw).toString("base64url");
  return `${payload}.${signPayload(raw)}`;
}

export function parsePublishedOAuthState(state: string): PublishedOAuthState | null {
  const [payloadB64, sig] = state.split(".");
  if (!payloadB64 || !sig) return null;
  let raw: string;
  try {
    raw = Buffer.from(payloadB64, "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (signPayload(raw) !== sig) return null;
  const parts = raw.split(":");
  if (parts[0] !== "pub" || parts.length < 7) return null;
  const returnUrl = decodeURIComponent(parts[4] ?? "/");
  if (!returnUrl.startsWith("/") || returnUrl.startsWith("//")) return null;
  return {
    projectId: parts[1]!,
    publishedAppId: parts[2]!,
    slug: parts[3]!,
    returnUrl,
    provider: parts[5]!,
    nonce: parts[6]!,
  };
}

export { COOKIE_NAME as PUBLISHED_OAUTH_COOKIE };
