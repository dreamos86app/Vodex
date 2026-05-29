import { NextResponse } from "next/server";
import { requireDreamosOwner } from "@/lib/admin/require-owner";
import { buildAuthConfigSnapshot } from "@/lib/supabase/auth-config-snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Safe Supabase/OAuth config diagnostic (no secrets).
 * Dev: open without auth. Production: owner session or DREAMOS_DEV_DIAGNOSTICS=1.
 */
export async function GET(request: Request) {
  const devOpen =
    process.env.NODE_ENV !== "production" || process.env.DREAMOS_DEV_DIAGNOSTICS === "1";

  if (!devOpen) {
    const gate = await requireDreamosOwner();
    if (gate.error) {
      return NextResponse.json(
        {
          error: "Forbidden",
          hint: "Sign in as a DreamOS86 owner, or set DREAMOS_DEV_DIAGNOSTICS=1 on Vercel for this route.",
        },
        { status: 403 },
      );
    }
  }

  const snapshot = await buildAuthConfigSnapshot(request.url);

  return NextResponse.json(snapshot);
}
