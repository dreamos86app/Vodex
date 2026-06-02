import { NextResponse } from "next/server";
import { fetchPublicStatusPayload } from "@/lib/status/status-public";

export async function GET() {
  const payload = await fetchPublicStatusPayload();
  if (!payload.ok) {
    return NextResponse.json({ announcement: null });
  }
  return NextResponse.json({ announcement: payload.activeAnnouncement });
}
