import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runProductionCertification } from "@/lib/certification/run-production-certification";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
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

  let includePlatform = false;
  try {
    const body = (await req.json()) as { includePlatform?: boolean };
    includePlatform = body.includePlatform === true;
  } catch {
    includePlatform = false;
  }

  const result = await runProductionCertification({
    projectId,
    ownerId: user.id,
    includePlatform,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ certification: result });
}
