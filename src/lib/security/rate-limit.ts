import { NextResponse } from "next/server";

type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSec: number };

/** In-memory sliding-window rate limit (per server instance). */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  if (entry.count >= limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }
  entry.count += 1;
  return { allowed: true };
}

export function rateLimitedResponse(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    {
      error: "Too many requests. Please wait and try again.",
      code: "rate_limited",
      retryAfterSec,
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    },
  );
}

export const EXPENSIVE_ROUTE_LIMITS = {
  chat: { limit: 24, windowMs: 60_000 },
  build: { limit: 12, windowMs: 60_000 },
  blueprint: { limit: 20, windowMs: 60_000 },
  polish: { limit: 16, windowMs: 60_000 },
  repair: { limit: 10, windowMs: 60_000 },
  preview: { limit: 20, windowMs: 60_000 },
  publish: { limit: 10, windowMs: 60_000 },
  deploy: { limit: 8, windowMs: 60_000 },
  credits: { limit: 30, windowMs: 60_000 },
  auth: { limit: 20, windowMs: 60_000 },
  diff: { limit: 40, windowMs: 60_000 },
} as const;
