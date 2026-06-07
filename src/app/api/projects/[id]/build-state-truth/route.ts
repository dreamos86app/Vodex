import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  inspectBuildStateTruth,
  repairBuildStateTruth,
} from "@/lib/build/build-state-truth-repair";
import { requireProjectId, jsonMissingId } from "@/lib/ids/required-ids";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await ctx.params;
  const projectId = requireProjectId(rawId);
  if (!projectId) return jsonMissingId("projectId", "Project id is required.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const writer = createServiceRoleClient() ?? supabase;
  const debug = await inspectBuildStateTruth(writer, projectId, user.id);
  return NextResponse.json({ ok: true, debug });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await ctx.params;
  const projectId = requireProjectId(rawId);
  if (!projectId) return jsonMissingId("projectId", "Project id is required.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    dryRun?: boolean;
    startPreview?: boolean;
  };

  const writer = createServiceRoleClient() ?? supabase;
  const result = await repairBuildStateTruth(writer, projectId, user.id, {
    apply: body.dryRun !== true,
    startPreview: body.startPreview !== false,
  });

  return NextResponse.json({
    ok: true,
    applied: result.applied,
    debug: result.debug,
    resolved: {
      build_status: result.resolved.buildStatus,
      job_status: result.resolved.jobStatus,
      failure_kind: result.resolved.failureKind,
      headline: result.resolved.headline,
    },
    preview_start_attempted: result.previewStartAttempted,
    preview_start_ok: result.previewStartOk,
  });
}
