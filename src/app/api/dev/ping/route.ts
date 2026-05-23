import { NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

/** Lightweight dev-server probe for verify scripts (no auth, no DB). */
export async function GET() {
  return NextResponse.json({ ok: true }, { status: 200 });
}
