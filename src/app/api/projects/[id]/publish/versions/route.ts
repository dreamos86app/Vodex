import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { listPublishVersions, republishNewVersion, rollbackPublishVersion } from "@/lib/publish/publish-versioning";
import { requireProjectId, jsonMissingId } from "@/lib/ids/required-ids";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await ctx.params;
  const projectId = requireProjectId(rawId);
  if (!projectId) return jsonMissingId("projectId", "Project id is required.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const writer = createServiceRoleClient() ?? supabase;
  const versions = await listPublishVersions(writer, projectId, user.id);
  return NextResponse.json({ versions });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await ctx.params;
  const projectId = requireProjectId(rawId);
  if (!projectId) return jsonMissingId("projectId", "Project id is required.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const writer = createServiceRoleClient() ?? supabase;
  let body: { action?: string; version?: number } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* republish default */
  }

  if (body.action === "rollback" && typeof body.version === "number") {
    const result = await rollbackPublishVersion({
      writer,
      userId: user.id,
      projectId,
      version: body.version,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  }

  const result = await republishNewVersion({ writer, userId: user.id, projectId });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
