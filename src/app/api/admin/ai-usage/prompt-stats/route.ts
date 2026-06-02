import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { requireDreamosOwner } from "@/lib/admin/require-owner";
import { fetchAiUsagePromptStats } from "@/lib/admin/admin-query-compat";

export async function GET() {
  const gate = await requireDreamosOwner();
  if (gate.error) return gate.error;

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server misconfigured";
    return NextResponse.json({ error: msg }, { status: 503 });
  }

  const sinceIso = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { stats, error } = await fetchAiUsagePromptStats(admin, sinceIso);

  if (error) {
    return NextResponse.json(
      {
        error,
        buckets: stats.buckets,
        builds: stats.builds,
        stats: { total: stats.buckets.all.count, success: stats.buckets.success.count, failed: stats.buckets.failed.count },
      },
      { status: 200 },
    );
  }

  return NextResponse.json({
    buckets: stats.buckets,
    builds: stats.builds,
    sinceIso,
    stats: { total: stats.buckets.all.count, success: stats.buckets.success.count, failed: stats.buckets.failed.count },
  });
}
