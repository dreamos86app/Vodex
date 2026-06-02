import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requireDreamosOwner } from "@/lib/admin/require-owner";
import { fetchAiUsageByPrompt } from "@/lib/admin/admin-query-compat";

export async function GET(request: Request) {
  const gate = await requireDreamosOwner();
  if (gate.error) return gate.error;

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server misconfigured";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const url = new URL(request.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get("days") ?? "90", 10) || 90, 1), 180);
  const sinceIso = new Date(Date.now() - days * 86400000).toISOString();

  const { prompts, requestTotals, error } = await fetchAiUsageByPrompt(admin, sinceIso);
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ prompts, requestTotals, days });
}
