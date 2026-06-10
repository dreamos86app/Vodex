import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { requireProjectId, jsonMissingId } from "@/lib/ids/required-ids";
import { applyPreviewBuildToProject } from "@/lib/imports/apply-preview-build-to-project";
import { loadLatestPreviewDiagnostics } from "@/lib/imports/runtime-build-runner";
import { loadPreviewRuntimeStatus } from "@/lib/preview/load-preview-runtime-status";
import {
  buildInternalPreviewHtmlUrl,
  buildVirtualPreviewRuntimeUrl,
  normalizeStoredPreviewUrl,
} from "@/lib/preview/internal-preview-url";

export const dynamic = "force-dynamic";

/** Repair stale preview metadata / URLs when worker succeeded but UI state is inconsistent. */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await ctx.params;
  const projectId = requireProjectId(rawId);
  if (!projectId) return jsonMissingId("projectId", "Project id is required.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("metadata, preview_url")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Service role unavailable" }, { status: 503 });
  }

  const meta =
    project.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
      ? (project.metadata as Record<string, unknown>)
      : {};

  const diagnostics = await loadLatestPreviewDiagnostics(admin, projectId);
  const runtimeBefore = await loadPreviewRuntimeStatus(supabase, projectId, meta);

  let repaired = false;
  const patches: Record<string, unknown> = {};

  if (diagnostics?.previewRenderable && runtimeBefore.jobStatus === "succeeded") {
    await applyPreviewBuildToProject({
      writer: admin,
      projectId,
      userId: user.id,
      diagnostics,
    });
    repaired = true;
    patches.preview_renderable = true;
  }

  const artifactId = runtimeBefore.jobId ?? diagnostics?.jobId ?? null;
  let previewUrl = await normalizeStoredPreviewUrl({
    projectId,
    previewUrl: project.preview_url,
    persist: false,
    admin,
  });

  if (artifactId) {
    const canonical = buildVirtualPreviewRuntimeUrl({
      projectId,
      artifactBuildId: artifactId,
      route: "/",
      cacheBust: artifactId,
    });
    if (!previewUrl || !previewUrl.includes("/preview-runtime/")) {
      previewUrl = canonical;
      await admin.from("projects").update({ preview_url: canonical }).eq("id", projectId);
      repaired = true;
      patches.preview_url = canonical;
    }
  } else if (!previewUrl && diagnostics?.previewRenderable) {
    previewUrl = buildInternalPreviewHtmlUrl({ projectId });
    await admin.from("projects").update({ preview_url: previewUrl }).eq("id", projectId);
    repaired = true;
    patches.preview_url = previewUrl;
  }

  if (meta.continuing_generation_needed === true && diagnostics?.previewRenderable) {
    await admin
      .from("projects")
      .update({
        metadata: {
          ...meta,
          continuing_generation_needed: false,
          preview_renderable: true,
          preview_honest: true,
        },
      })
      .eq("id", projectId);
    repaired = true;
    patches.continuing_generation_needed = false;
  }

  const runtimeAfter = await loadPreviewRuntimeStatus(supabase, projectId, {
    ...meta,
    ...patches,
    preview_renderable: patches.preview_renderable ?? meta.preview_renderable,
  });

  return NextResponse.json({
    ok: true,
    repaired,
    patches,
    runtime: runtimeAfter,
    previewUrl,
    canonicalStateHint:
      runtimeAfter.previewRenderable && runtimeAfter.jobStatus === "succeeded" ? "ready" : "needs_attention",
  });
}
