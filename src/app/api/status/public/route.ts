import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canViewFullStatusPage } from "@/lib/admin-owner";
import { fetchPublicStatusPayload } from "@/lib/status/status-public";

export async function GET() {
  let fullView = false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    fullView = canViewFullStatusPage(user?.email);
  } catch {
    fullView = false;
  }

  const payload = await fetchPublicStatusPayload({ fullView });
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" },
  });
}
