import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { filterRenderableBuildFiles } from "@/lib/build/generated-file-utils";
import { runDeterministicPreviewRepair } from "@/lib/build/preview-deterministic-repair";
import { persistGeneratedBuildFiles } from "@/lib/build/persist-generated-files";
import { startPreviewSession } from "@/lib/preview/preview-build-service";
import {
  mapLegacyPreviewErrorCode,
  isPreviewFailureCode,
  type PreviewFailureCode,
} from "@/lib/preview/preview-failure-codes";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string; jobId: string }> },
) {
  const { id: projectId, jobId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { data: proj } = await supabase
    .from("projects")
    .select("id, metadata, app_name")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!proj) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const reader = createServiceRoleClient() ?? supabase;
  const { data: job } = await reader
    .from("build_jobs")
    .select("id, status")
    .eq("id", jobId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!job) return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });

  const meta =
    proj.metadata && typeof proj.metadata === "object" && !Array.isArray(proj.metadata)
      ? (proj.metadata as Record<string, unknown>)
      : {};
  const rawCode = meta.preview_error_code as string | undefined;
  const code: PreviewFailureCode = isPreviewFailureCode(rawCode ?? "")
    ? (rawCode as PreviewFailureCode)
    : mapLegacyPreviewErrorCode(rawCode);

  const { data: fileRows } = await reader
    .from("app_files")
    .select("path, content")
    .eq("project_id", projectId);
  const files = filterRenderableBuildFiles(
    (fileRows ?? []).map((f) => ({ path: f.path, content: f.content ?? "" })),
  );

  const repair = runDeterministicPreviewRepair({
    files,
    failureCode: code,
    appName: proj.app_name ?? "Your app",
  });
  if (!repair.applied) {
    return NextResponse.json({ ok: false, error: "Repair not applicable", can_repair: false });
  }

  await persistGeneratedBuildFiles({
    writer: reader,
    projectId,
    ownerId: user.id,
    files: repair.files,
  });

  const preview = await startPreviewSession({
    writer: reader,
    userId: user.id,
    projectId,
  });

  return NextResponse.json({
    ok: preview.ok,
    preview_ok: preview.ok,
    can_repair: false,
    codes_addressed: repair.codesAddressed,
    error: preview.ok ? null : preview.error,
  });
}
