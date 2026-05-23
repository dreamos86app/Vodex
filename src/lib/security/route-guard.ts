import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  requireAuthUser,
  isNextResponse,
} from "@/lib/ids/api-mutation-guard";
import {
  checkRateLimit,
  rateLimitedResponse,
  EXPENSIVE_ROUTE_LIMITS,
} from "@/lib/security/rate-limit";
import { rejectTrustedClientUserId } from "@/lib/security/client-identity";

type LimitKey = keyof typeof EXPENSIVE_ROUTE_LIMITS;

export function enforceRateLimit(
  routeKey: LimitKey,
  userId: string,
): NextResponse | null {
  const cfg = EXPENSIVE_ROUTE_LIMITS[routeKey];
  const result = checkRateLimit(`${routeKey}:${userId}`, cfg.limit, cfg.windowMs);
  if (!result.allowed) return rateLimitedResponse(result.retryAfterSec);
  return null;
}

/** Auth + optional body identity check + rate limit for expensive routes. */
export function guardExpensiveRoute(
  user: User | null | undefined,
  routeKey: LimitKey,
  body?: Record<string, unknown> | null,
): User | NextResponse {
  const auth = requireAuthUser(user);
  if (isNextResponse(auth)) return auth;

  const identityReject = rejectTrustedClientUserId(body ?? null, auth.id);
  if (identityReject) return identityReject;

  const rateReject = enforceRateLimit(routeKey, auth.id);
  if (rateReject) return rateReject;

  return auth;
}
