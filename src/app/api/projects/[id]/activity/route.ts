import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const admin = createServiceRoleClient();
  if (!admin) return NextResponse.json({ events: [] });

  const { data, error } = await admin
    .from("app_activity_events" as never)
    .select("id, category, action, summary, meta, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[activity] query failed:", error.message);
    return NextResponse.json({ events: [], unavailable: true });
  }

  return NextResponse.json({ events: data ?? [] });
}
