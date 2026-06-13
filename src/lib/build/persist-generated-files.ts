import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  mayClearGeneratedFiles,
  type ClearGeneratedFilesContext,
} from "@/lib/build/clear-generated-files-policy";
import {
  filterRenderableBuildFiles,
  isHiddenGeneratedPath,
  type BuildFile,
} from "@/lib/build/generated-file-utils";
import { normalizeAppRouterBuildFiles } from "@/lib/build/app-router-route-normalizer";
import { MIN_RENDERABLE_FILES } from "@/lib/build/build-success-contract";
import { evaluateSourceIntegrity } from "@/lib/build/source-integrity-validator";
import { computeFileLineMeta } from "@/lib/build/file-line-counts";
import {
  emitFileWriteEvent,
  type WorkflowStepCtx,
} from "@/lib/build/workflow-live-events";
import {
  injectMobileBaselineIntoBuildFiles,
  logMobileQualityAfterInject,
} from "@/lib/build/inject-mobile-baseline";

type Writer = SupabaseClient<Database>;

export type PersistWorkflowEmitOptions = {
  writer: Writer;
  ctx: WorkflowStepCtx;
};

function persistenceWriter(writer: Writer): Writer {
  return (createServiceRoleClient() ?? writer) as Writer;
}

export type PersistBuildFilesResult = {
  /** Rows written to storage without upsert error. */
  ok: boolean;
  persistOk: boolean;
  integrityOk: boolean;
  savedCount: number;
  renderableCount: number;
  error?: string;
  errorCode?: string;
};

/** Upsert only real source files; never metadata snippets. */
export async function persistGeneratedBuildFiles(input: {
  writer: Writer;
  projectId: string;
  ownerId: string;
  files: BuildFile[];
  source?: string;
  operationId?: string;
  executionInstanceId?: string;
  /** Emit per-file workflow events after successful upsert. */
  workflowEmit?: PersistWorkflowEmitOptions;
  appName?: string;
}): Promise<PersistBuildFilesResult> {
  const writer = persistenceWriter(input.writer);
  const normalized = normalizeAppRouterBuildFiles(input.files, {
    appName: input.appName ?? "Dream App",
  });
  const withMobile = injectMobileBaselineIntoBuildFiles(normalized.files, {
    appName: input.appName ?? "Dream App",
    projectId: input.projectId,
  });
  logMobileQualityAfterInject(withMobile);
  const renderable = filterRenderableBuildFiles(withMobile);
  if (renderable.length === 0) {
    return {
      ok: false,
      persistOk: false,
      integrityOk: false,
      savedCount: 0,
      renderableCount: 0,
      error: "no_renderable_files",
      errorCode: "no_renderable_files",
    };
  }

  if (process.env.NODE_ENV !== "production") {
    console.info("[persist-generated-files] before upsert", {
      projectId: input.projectId,
      ownerId: input.ownerId,
      operationId: input.operationId,
      executionInstanceId: input.executionInstanceId,
      renderableCount: renderable.length,
      samplePaths: renderable.slice(0, 10).map((f) => f.path),
    });
  }

  const paths = renderable.map((f) => f.path);
  const prevContent = new Map<string, string>();
  if (paths.length > 0) {
    const { data: existingRows } = await writer
      .from("app_files")
      .select("path, content")
      .eq("project_id", input.projectId)
      .in("path", paths);
    for (const row of existingRows ?? []) {
      if (row.path) prevContent.set(row.path, row.content ?? "");
    }
  }

  const rows = renderable.map((f) => ({
    project_id: input.projectId,
    owner_id: input.ownerId,
    path: f.path,
    content: f.content,
    language: f.language ?? f.path.split(".").pop() ?? "text",
    mime_type: f.path.endsWith(".json") ? "application/json" : "text/plain",
    size_bytes: Buffer.byteLength(f.content, "utf8"),
    source: input.source ?? "generated",
    metadata: {
      kind: "source",
      operation_id: input.operationId ?? null,
      execution_instance_id: input.executionInstanceId ?? null,
    } as never,
  }));

  const { error: afErr } = await writer.from("app_files").upsert(rows as never, {
    onConflict: "project_id,path",
  });

  if (afErr) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[persist-generated-files] upsert failed:", afErr.message);
    }
    return {
      ok: false,
      persistOk: false,
      integrityOk: false,
      savedCount: 0,
      renderableCount: renderable.length,
      error: afErr.message,
      errorCode: afErr.code ?? "upsert_failed",
    };
  }

  const { count } = await writer
    .from("app_files")
    .select("path", { count: "exact", head: true })
    .eq("project_id", input.projectId);

  const { data: storedPaths } = await writer
    .from("app_files")
    .select("path")
    .eq("project_id", input.projectId)
    .limit(200);

  const visibleCount =
    storedPaths?.filter((p) => p.path && !isHiddenGeneratedPath(p.path)).length ??
    count ??
    renderable.length;

  const persistOk = visibleCount > 0;

  if (process.env.NODE_ENV !== "production") {
    console.info("[persist-generated-files] after upsert", {
      projectId: input.projectId,
      visibleCount,
      renderableCount: renderable.length,
    });
  }

  if (persistOk && renderable.length > 0) {
    try {
      const { saveAppVersionSnapshot } = await import("@/lib/projects/app-version-history");
      const { data: projectRow } = await writer
        .from("projects")
        .select("owner_id, workspace_id")
        .eq("id", input.projectId)
        .maybeSingle();
      if (projectRow?.owner_id) {
        const saved = await saveAppVersionSnapshot({
          admin: writer,
          projectId: input.projectId,
          ownerId: projectRow.owner_id,
          workspaceId: projectRow.workspace_id,
          createdBy: projectRow.owner_id,
          mode: "build",
          summary: `Preview snapshot — ${renderable.length} files`,
          files: renderable.map((f) => ({ path: f.path, content: f.content })),
        });
        if (saved?.versionId) {
          const { data: cur } = await writer
            .from("projects")
            .select("metadata")
            .eq("id", input.projectId)
            .maybeSingle();
          const prevMeta =
            cur?.metadata && typeof cur.metadata === "object" && !Array.isArray(cur.metadata)
              ? (cur.metadata as Record<string, unknown>)
              : {};
          await writer
            .from("projects")
            .update({
              metadata: {
                ...prevMeta,
                current_preview_version_id: saved.versionId,
              } as never,
            } as never)
            .eq("id", input.projectId);
        }
      }
    } catch {
      /* version history is best-effort */
    }
  }

  if (input.workflowEmit && persistOk) {
    const sorted = [...renderable].sort((a, b) => a.path.localeCompare(b.path));
    const total = sorted.length;
    for (let i = 0; i < sorted.length; i++) {
      const f = sorted[i]!;
      const prev = prevContent.get(f.path);
      const lineMeta = computeFileLineMeta(prev, f.content);
      const isCreate = prev == null || prev.trim().length === 0;
      const progressPercent = Math.min(88, 72 + Math.round(((i + 1) / total) * 14));
      await emitFileWriteEvent(input.workflowEmit.writer, input.workflowEmit.ctx, {
        action: isCreate ? "created" : "updated",
        filePath: f.path,
        linesAdded: lineMeta?.added_lines ?? 0,
        linesRemoved: lineMeta?.removed_lines ?? 0,
        currentFile: i + 1,
        totalFiles: total,
        progressPercent,
      });
      if (i < sorted.length - 1) {
        await new Promise((r) => setTimeout(r, 48));
      }
    }
  }

  const integrity = evaluateSourceIntegrity(renderable);
  const integrityOk = integrity.sourceIntegrityOk;
  return {
    ok: persistOk,
    persistOk,
    integrityOk,
    savedCount: visibleCount,
    renderableCount: renderable.length,
    error: !integrityOk ? integrity.blockedReason ?? "source_integrity_failed" : undefined,
    errorCode: !integrityOk ? "source_integrity_incomplete" : undefined,
  };
}

/** Remove generated source files when a build fails — only the claiming worker may clear. */
export async function clearGeneratedBuildFiles(input: {
  writer: Writer;
  projectId: string;
  ownerId: string;
  buildJobId?: string;
  executionInstanceId?: string;
  /** Why the clear is requested — blocks clear after persist + preview failure. */
  context?: ClearGeneratedFilesContext;
}): Promise<{ cleared: boolean; reason?: string }> {
  if (input.context && !mayClearGeneratedFiles(input.context)) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[persist-generated-files] clear blocked — policy", {
        context: input.context,
        projectId: input.projectId,
      });
    }
    return { cleared: false, reason: `policy_blocked:${input.context}` };
  }

  const writer = persistenceWriter(input.writer);

  if (input.buildJobId && input.executionInstanceId) {
    const { data: job } = await writer
      .from("build_jobs")
      .select("execution_instance_id, status")
      .eq("id", input.buildJobId)
      .maybeSingle();
    const owner = job?.execution_instance_id ?? null;
    if (owner && owner !== input.executionInstanceId) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[persist-generated-files] clear blocked — stale worker", {
          buildJobId: input.buildJobId,
          owner,
          attempted: input.executionInstanceId,
        });
      }
      return { cleared: false, reason: "stale_worker" };
    }

    if (job?.status === "completed") {
      return { cleared: false, reason: "job_already_completed" };
    }
  }

  await writer
    .from("app_files")
    .delete()
    .eq("project_id", input.projectId)
    .eq("owner_id", input.ownerId)
    .eq("source", "generated");

  return { cleared: true };
}

/** Upsert a single generated file as soon as it is extracted — survives mid-build timeouts. */
export async function persistIncrementalBuildFile(input: {
  writer: Writer;
  projectId: string;
  ownerId: string;
  file: BuildFile;
  operationId?: string;
  executionInstanceId?: string;
}): Promise<boolean> {
  const writer = persistenceWriter(input.writer);
  const renderable = filterRenderableBuildFiles([input.file]);
  if (renderable.length === 0) return false;
  const f = renderable[0]!;
  const row = {
    project_id: input.projectId,
    owner_id: input.ownerId,
    path: f.path,
    content: f.content,
    language: f.language ?? f.path.split(".").pop() ?? "text",
    mime_type: f.path.endsWith(".json") ? "application/json" : "text/plain",
    size_bytes: Buffer.byteLength(f.content, "utf8"),
    source: "generated",
    metadata: {
      kind: "source",
      operation_id: input.operationId ?? null,
      execution_instance_id: input.executionInstanceId ?? null,
      incremental_persist: true,
    } as never,
  };
  const { error } = await writer.from("app_files").upsert(row as never, {
    onConflict: "project_id,path",
  });
  return !error;
}
