import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { planIncludesAnalytics } from "@/lib/pricing";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan_id")
    .eq("id", user.id)
    .maybeSingle();

  const planId = profile?.plan_id ?? "free";
  if (!planIncludesAnalytics(planId)) {
    return NextResponse.json(
      { error: "Analytics requires Starter or above", code: "plan_upgrade_required", requiredPlan: "starter" },
      { status: 403 },
    );
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Credit events for the past 30 days
  const { data: events } = await supabase
    .from("credit_events")
    .select("created_at, credits_consumed, model_id, event_type")
    .eq("user_id", user.id)
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: true });

  // Build daily series
  const dailyMap: Record<string, { date: string; credits: number; generations: number }> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().substring(0, 10);
    dailyMap[key] = { date: key, credits: 0, generations: 0 };
  }

  const modelBreakdown: Record<string, number> = {};
  let totalCredits = 0;
  let totalGenerations = 0;

  for (const ev of events ?? []) {
    const day = ev.created_at.substring(0, 10);
    if (dailyMap[day] && ev.event_type === "generation") {
      dailyMap[day].credits += ev.credits_consumed;
      dailyMap[day].generations += 1;
      modelBreakdown[ev.model_id] = (modelBreakdown[ev.model_id] ?? 0) + ev.credits_consumed;
      totalCredits += ev.credits_consumed;
      totalGenerations += 1;
    }
  }

  // Deployments this period
  const { count: deploymentsCount } = await supabase
    .from("deployments")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", thirtyDaysAgo);

  // Media uploads
  const { count: uploadsCount } = await supabase
    .from("media_assets")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", thirtyDaysAgo);

  return NextResponse.json({
    daily: Object.values(dailyMap),
    model_breakdown: modelBreakdown,
    totals: {
      credits_used: totalCredits,
      generations: totalGenerations,
      deployments: deploymentsCount ?? 0,
      uploads: uploadsCount ?? 0,
    },
  });
}
