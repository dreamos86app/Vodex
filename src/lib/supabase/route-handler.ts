/**
 * Supabase client for App Router route handlers — binds cookie writes to the Response.
 */
import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import type { CookieOptions } from "@supabase/ssr";
import type { Database } from "./types";

export type PendingAuthCookie = {
  name: string;
  value: string;
  options: CookieOptions;
};

export function applyPendingAuthCookies(
  response: NextResponse,
  pending: PendingAuthCookie[],
): void {
  pending.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options),
  );
}

export function createRouteHandlerClient(
  request: NextRequest,
  response: NextResponse,
  pending?: PendingAuthCookie[],
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("[DreamOS86] Missing Supabase environment variables.");
  }

  return createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          if (pending) pending.push({ name, value, options });
          response.cookies.set(name, value, options);
        });
      },
    },
  });
}
