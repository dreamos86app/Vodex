import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ACTIVE_STATUSES = ["running", "queued", "starting"] as const;

/** Latest resumable build job for a project (server source of truth after refresh). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("id, owner_id")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!project) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const reader = createServiceRoleClient() ?? supabase;
  const { data: jobs } = await reader
    .from("build_jobs")
    .select("id, status, prompt, conversation_id, meta, created_at, started_at, error_message")
    .eq("project_id", projectId)
    .in("status", [...ACTIVE_STATUSES])
    .order("created_at", { ascending: false })
    .limit(1);

  const job = jobs?.[0] ?? null;
  if (!job) {
    return NextResponse.json({ ok: true, active: false });
  }

  const meta =
    job.meta && typeof job.meta === "object" && !Array.isArray(job.meta)
      ? (job.meta as Record<string, unknown>)
      : {};

  const { data: events } = await reader
    .from("build_job_events")
    .select("id, created_at, type, title, detail, file_path, progress_percent, metadata")
    .eq("job_id", job.id)
    .order("created_at", { ascending: true })
    .limit(120);

  return NextResponse.json({
    ok: true,
    active: true,
    job: {
      id: job.id,
      status: job.status,
      prompt: job.prompt ?? (meta.user_prompt as string | undefined) ?? (meta.prompt as string | undefined) ?? null,
      conversation_id: job.conversation_id ?? null,
      mode_at_submit: (meta.mode_at_submit as string | undefined) ?? (meta.mode as string | undefined) ?? null,
      error_message: job.error_message ?? null,
      events_url: `/api/projects/${projectId}/build-jobs/${job.id}/events`,
    },
    events: events ?? [],
  });
}
