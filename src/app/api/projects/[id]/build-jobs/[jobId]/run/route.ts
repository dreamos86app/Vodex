import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { executeStagedBuildJob } from "@/lib/build/execute-staged-build-job";
import { resolveStagedBuildJobInput } from "@/lib/build/resolve-staged-build-job-input";
import { buildMaxDurationSec } from "@/lib/build/kick-staged-build-worker";
import { persistBuildJobEvent } from "@/lib/build/build-job-events";

export const dynamic = "force-dynamic";
/** Vercel serverless — dedicated invocation for full AI builds (not chat after()). */
export const maxDuration = buildMaxDurationSec();

function authorize(req: Request): boolean {
  const secret =
    process.env.DREAMOS_BUILD_RUN_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; jobId: string }> },
) {
  if (!authorize(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "Service role unavailable" }, { status: 503 });
  }

  const { id: projectId, jobId: buildJobId } = await ctx.params;
  const jobInput = await resolveStagedBuildJobInput(admin, projectId, buildJobId);
  if (!jobInput) {
    return NextResponse.json({ ok: false, error: "Job not runnable" }, { status: 404 });
  }

  await persistBuildJobEvent(admin, {
    jobId: buildJobId,
    projectId,
    userId: jobInput.userId,
    type: "planning_app",
    title: "Build worker started",
    detail: `Long-running build route (max ${maxDuration}s)`,
    metadata: {
      stream_category: "phase_started",
      build_run_route: true,
      max_duration_sec: maxDuration,
      hidden: true,
    },
  }).catch(() => undefined);

  try {
    await executeStagedBuildJob(jobInput);
    return NextResponse.json({ ok: true, buildJobId, status: "finished" });
  } catch (err) {
    console.error("[build-run-route] worker_error", {
      buildJobId,
      projectId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        buildJobId,
      },
      { status: 500 },
    );
  }
}
