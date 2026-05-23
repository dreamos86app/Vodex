import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireProjectId, jsonMissingId } from "@/lib/ids/required-ids";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await ctx.params;
  const projectId = requireProjectId(rawId);
  if (!projectId) return jsonMissingId("projectId", "Project id is required.");

  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId")?.trim();
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const writer = createServiceRoleClient() ?? supabase;
  const { data } = await writer
    .from("preview_sessions" as never)
    .select("logs, error, status")
    .eq("id", sessionId)
    .eq("project_id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    logs: (data as { logs?: unknown }).logs ?? [],
    error: (data as { error?: string }).error ?? null,
    status: (data as { status?: string }).status,
  });
}
