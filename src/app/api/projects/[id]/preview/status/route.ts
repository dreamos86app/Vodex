import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { refreshPreviewSessionStatus } from "@/lib/preview/preview-build-service";
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
  const poll = url.searchParams.get("poll") === "1";

  if (poll) {
    const refreshed = await refreshPreviewSessionStatus({
      writer,
      userId: user.id,
      projectId,
      sessionId,
    });
    if (!refreshed) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      id: sessionId,
      status: refreshed.status,
      preview_url: refreshed.previewUrl,
      external_url: refreshed.externalUrl,
      provider_level: refreshed.providerLevel,
      error: refreshed.error,
      logs: refreshed.logs,
    });
  }

  const { data } = await writer
    .from("preview_sessions" as never)
    .select("id, status, preview_url, error, updated_at, expires_at, provider_level, external_url, logs")
    .eq("id", sessionId)
    .eq("project_id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}
