import { NextResponse } from "next/server";

const TRUSTED_ID_FIELDS = ["user_id", "userId", "owner_id", "ownerId"] as const;

/** Reject requests that supply a different user id than the authenticated session. */
export function rejectTrustedClientUserId(
  body: Record<string, unknown> | null | undefined,
  authUserId: string,
): NextResponse | null {
  if (!body) return null;
  for (const field of TRUSTED_ID_FIELDS) {
    const value = body[field];
    if (typeof value === "string" && value.trim() && value.trim() !== authUserId) {
      return NextResponse.json(
        {
          error: "Request identity does not match your session.",
          code: "identity_mismatch",
        },
        { status: 403 },
      );
    }
  }
  return null;
}
