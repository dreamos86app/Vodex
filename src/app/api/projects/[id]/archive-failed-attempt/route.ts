import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { readLifecycleFromMetadata, lifecyclePatch } from "@/lib/projects/project-lifecycle";
import { hasMeaningfulProjectFiles } from "@/lib/projects/project-visibility-status";

export const dynamic = "force-dynamic";

/** Mark empty failed first-prompt project as archived / failed_attempt. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const writer = createServiceRoleClient() ?? supabase;
  const { data: project } = await writer
    .from("projects")
    .select("id, metadata, build_status, owner_id")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!project) {
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const meta =
    project.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
      ? (project.metadata as Record<string, unknown>)
      : {};

  if (hasMeaningfulProjectFiles(meta)) {
    return NextResponse.json(
      { ok: false, error: "Project has files — use draft flow instead", code: "has_files" },
      { status: 400 },
    );
  }

  const { lifecycle_status } = readLifecycleFromMetadata(meta);
  await writer
    .from("projects")
    .update({
      metadata: {
        ...meta,
        ...lifecyclePatch(lifecycle_status ?? "failed", {
          visibility_status: "failed_attempt",
          hide_from_home_main: true,
          archived_failed_attempt_at: new Date().toISOString(),
        }),
      },
    } as never)
    .eq("id", projectId);

  return NextResponse.json({ ok: true, visibility_status: "failed_attempt" });
}
