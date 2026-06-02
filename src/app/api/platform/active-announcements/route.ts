import { NextResponse } from "next/server";
import { fetchPublicStatusPayload } from "@/lib/status/status-public";

export async function GET() {
  const payload = await fetchPublicStatusPayload();
  if (!payload.ok) {
    return NextResponse.json({ announcements: [], schemaReady: false });
  }
  return NextResponse.json({
    announcements: payload.activeAnnouncements ?? [],
    schemaReady: payload.schemaReady ?? true,
  });
}
