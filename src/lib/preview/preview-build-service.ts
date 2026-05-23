import type { SupabaseClient } from "@supabase/supabase-js";
import { validateGeneratedApp } from "@/lib/build/generated-app-validator";
import { uiQualityBlocksGenerated, reviewGeneratedUi } from "@/lib/generation/generated-ui-review";
import { readCreateFlowConfig } from "@/lib/create/create-flow-config";
import {
  lifecyclePatch,
  normalizeProjectStatus,
  readLifecycleFromMetadata,
} from "@/lib/projects/project-lifecycle";
import { capturePublishedSnapshot } from "@/lib/publish/published-snapshot";
import { buildPreviewPageUrl } from "@/lib/preview/preview-url";
import { appendPreviewLog, previewExpiresAt, type PreviewSessionStatus } from "@/lib/preview/preview-session";
import { pickPreviewEntry, stripSecretsFromFiles } from "@/lib/preview/preview-sandbox";
import { resolvePreviewProvider } from "@/lib/preview/preview-provider-registry";
import { pollVercelPreviewUrl } from "@/lib/preview/vercel-preview-provider";
import { getVercelServerConfig } from "@/lib/deploy/vercel-config";
import type { PreviewProviderLevel } from "@/lib/preview/preview-provider-types";

type Writer = SupabaseClient;

export type PreviewStartResult =
  | {
      ok: true;
      sessionId: string;
      previewUrl: string;
      status: PreviewSessionStatus;
      providerLevel: PreviewProviderLevel;
      externalUrl?: string | null;
      lifecycleStatus: "preview_ready" | "needs_attention";
    }
  | { ok: false; error: string; code: string; sessionId?: string };

/** Lifecycle states that allow starting a preview session. */
const PREVIEW_ELIGIBLE = [
  "generated",
  "preview_ready",
  "publish_ready",
  "published",
  "imported",
  "imported_preview_ready",
  "imported_needs_setup",
] as const;

async function insertPreviewSession(input: {
  writer: Writer;
  row: Record<string, unknown>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await input.writer.from("preview_sessions" as never).insert(input.row as never);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function updateProjectPreviewState(input: {
  writer: Writer;
  projectId: string;
  userId: string;
  prevMeta: Record<string, unknown>;
  sessionId: string;
  status: PreviewSessionStatus;
  previewUrl: string | null;
  providerLevel: PreviewProviderLevel;
  externalUrl: string | null;
  now: string;
  deploymentId?: string | null;
}) {
  const lifecycleStatus = input.status === "ready" ? "preview_ready" : "needs_attention";
  await input.writer
    .from("projects")
    .update({
      preview_url: input.status === "ready" ? input.previewUrl : null,
      metadata: {
        ...input.prevMeta,
        ...lifecyclePatch(lifecycleStatus, {
          last_preview_session_id: input.sessionId,
          preview_honest: input.status === "ready",
          preview_provider_level: input.providerLevel,
          preview_external_url: input.externalUrl,
          preview_deployment_id: input.deploymentId ?? null,
          preview_ready: input.status === "ready",
          preview_failed_at: input.status === "failed" ? input.now : null,
        }),
      },
    } as never)
    .eq("id", input.projectId)
    .eq("owner_id", input.userId);

  return lifecycleStatus;
}

export async function startPreviewSession(input: {
  writer: Writer;
  userId: string;
  projectId: string;
}): Promise<PreviewStartResult> {
  const { data: project } = await input.writer
    .from("projects")
    .select("id, owner_id, metadata, build_status, preview_url, published_subdomain")
    .eq("id", input.projectId)
    .eq("owner_id", input.userId)
    .maybeSingle();

  if (!project) return { ok: false, error: "Project not found", code: "not_found" };

  const { count: fileCount } = await input.writer
    .from("app_files")
    .select("id", { count: "exact", head: true })
    .eq("project_id", input.projectId);

  const files = fileCount ?? 0;
  if (files < 1) {
    return { ok: false, error: "Preview requires generated files.", code: "no_files" };
  }

  const prevMeta =
    project.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
      ? (project.metadata as Record<string, unknown>)
      : {};

  const meta = readLifecycleFromMetadata(project.metadata);
  const lifecycle = normalizeProjectStatus(
    {
      lifecycleStatus: meta.lifecycle_status,
      buildStatus: project.build_status,
      fileCount: files,
      hasActiveBuildJob: false,
      publishedSubdomain: project.published_subdomain ?? null,
      previewUrl: project.preview_url,
      blueprintApproved: meta.blueprint_approved,
    },
    project.metadata,
  );

  if (!PREVIEW_ELIGIBLE.includes(lifecycle as (typeof PREVIEW_ELIGIBLE)[number])) {
    return {
      ok: false,
      error: "App must be generated or imported before preview.",
      code: "not_generated",
    };
  }

  const snapshot = await capturePublishedSnapshot(input.writer, input.projectId, input.userId);
  const safeFiles = stripSecretsFromFiles(snapshot.files);

  const createCfg = readCreateFlowConfig(prevMeta);
  const routeMap = Array.isArray(prevMeta.blueprint_routes)
    ? (prevMeta.blueprint_routes as string[])
    : null;

  const validation = validateGeneratedApp({
    files: safeFiles,
    projectId: input.projectId,
    ownerId: input.userId,
    routeMap,
  });

  const uiReview = reviewGeneratedUi({
    files: safeFiles,
    appType:
      typeof prevMeta.app_type === "string"
        ? prevMeta.app_type
        : typeof prevMeta.blueprint_app_type === "string"
          ? prevMeta.blueprint_app_type
          : null,
    stylePresetId: createCfg.stylePresetId,
    routeMap,
  });

  const entry = pickPreviewEntry(safeFiles);
  if (!entry) {
    return { ok: false, error: "No renderable entry (index.html or page.tsx).", code: "no_entry" };
  }

  const sessionId = crypto.randomUUID();
  const snapshotId = `${input.projectId}-preview-${Date.now()}`;
  const now = new Date().toISOString();
  let logs = appendPreviewLog([], "Preview session created");
  logs = appendPreviewLog(logs, "Snapshot captured");

  let status: PreviewSessionStatus = "building";
  let error: string | null = null;
  let providerLevel: PreviewProviderLevel = "in_app_sandbox";
  let externalUrl: string | null = null;
  let deploymentId: string | null = null;

  if (!validation.ok) {
    status = "failed";
    error = validation.reasons.slice(0, 3).join("; ");
    logs = appendPreviewLog(logs, `Validation failed: ${error}`);
  } else if (uiQualityBlocksGenerated(uiReview)) {
    status = "failed";
    error = `UI quality gate failed (score ${uiReview.overall})`;
    logs = appendPreviewLog(logs, error);
  } else {
    logs = appendPreviewLog(logs, "Validation passed — resolving preview provider");
    const vercelCfg = getVercelServerConfig(prevMeta);
    const providerResult = await resolvePreviewProvider({
      projectId: input.projectId,
      userId: input.userId,
      sessionId,
      files: safeFiles,
      vercelToken: vercelCfg.token || null,
      vercelProjectId: vercelCfg.projectId,
      projectMeta: prevMeta,
    });

    providerLevel = providerResult.level;
    externalUrl = providerResult.externalUrl ?? null;
    deploymentId = providerResult.deploymentId ?? null;
    for (const line of providerResult.logs) {
      logs = appendPreviewLog(logs, line);
    }

    if (providerResult.error === "not_connected" || providerResult.error === "needs_project_link") {
      logs = appendPreviewLog(logs, "Hosted preview unavailable — in-app snapshot is active.");
    }

    status = "ready";
    logs = appendPreviewLog(logs, `Preview ready via ${providerLevel}`);
  }

  const sessionPreviewUrl = buildPreviewPageUrl(sessionId);
  const previewUrl =
    status === "ready" && externalUrl?.startsWith("http") ? externalUrl : sessionPreviewUrl;

  const row = {
    id: sessionId,
    project_id: input.projectId,
    owner_id: input.userId,
    status,
    preview_url: previewUrl,
    snapshot_id: snapshotId,
    snapshot_files: safeFiles,
    logs,
    error,
    provider_level: providerLevel,
    external_url: externalUrl,
    deployment_id: deploymentId,
    created_at: now,
    updated_at: now,
    expires_at: previewExpiresAt(24),
  };

  const inserted = await insertPreviewSession({ writer: input.writer, row });
  if (!inserted.ok) {
    return { ok: false, error: inserted.error, code: "db_error" };
  }

  const lifecycleStatus = await updateProjectPreviewState({
    writer: input.writer,
    projectId: input.projectId,
    userId: input.userId,
    prevMeta,
    sessionId,
    status,
    previewUrl: status === "ready" ? previewUrl : null,
    providerLevel,
    externalUrl,
    now,
    deploymentId,
  });

  if (status === "failed") {
    return {
      ok: false,
      error: error ?? "Preview validation failed",
      code: "validation_failed",
      sessionId,
    };
  }

  return {
    ok: true,
    sessionId,
    previewUrl,
    status,
    providerLevel,
    externalUrl,
    lifecycleStatus,
  };
}

/** Poll Vercel deployment and upgrade session when hosted URL becomes available. */
export async function refreshPreviewSessionStatus(input: {
  writer: Writer;
  userId: string;
  projectId: string;
  sessionId: string;
}): Promise<{
  status: PreviewSessionStatus;
  previewUrl: string | null;
  externalUrl: string | null;
  providerLevel: string | null;
  logs: Array<{ at: string; message: string }>;
  error: string | null;
} | null> {
  const { data: session } = await input.writer
    .from("preview_sessions" as never)
    .select("*")
    .eq("id", input.sessionId)
    .eq("project_id", input.projectId)
    .eq("owner_id", input.userId)
    .maybeSingle();

  if (!session) return null;

  const row = session as {
    status?: PreviewSessionStatus;
    preview_url?: string | null;
    external_url?: string | null;
    provider_level?: string | null;
    logs?: Array<{ at: string; message: string }> | null;
    error?: string | null;
    deployment_id?: string | null;
  };

  let logs = row.logs ?? [];
  let externalUrl = row.external_url ?? null;
  let status = row.status ?? "pending";
  let previewUrl = row.preview_url ?? null;

  if (status === "ready" && !externalUrl) {
    const { data: project } = await input.writer
      .from("projects")
      .select("metadata")
      .eq("id", input.projectId)
      .maybeSingle();
    const meta =
      project?.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
        ? (project.metadata as Record<string, unknown>)
        : {};
    const deploymentId =
      typeof meta.preview_deployment_id === "string" ? meta.preview_deployment_id : null;

    if (deploymentId) {
      const polled = await pollVercelPreviewUrl({
        deploymentId,
        projectMeta: meta,
      });
      for (const line of polled.logs) {
        logs = appendPreviewLog(logs, line);
      }
      if (polled.url) {
        externalUrl = polled.url;
        previewUrl = polled.url;
        logs = appendPreviewLog(logs, `Hosted preview URL ready: ${polled.url}`);
        await input.writer
          .from("preview_sessions" as never)
          .update({
            status: "ready",
            preview_url: polled.url,
            external_url: polled.url,
            provider_level: "external_hosted",
            logs,
            updated_at: new Date().toISOString(),
          } as never)
          .eq("id", input.sessionId);

        await input.writer
          .from("projects")
          .update({
            preview_url: polled.url,
            metadata: {
              ...meta,
              preview_external_url: polled.url,
              preview_provider_level: "external_hosted",
              preview_ready: true,
              preview_honest: true,
            },
          } as never)
          .eq("id", input.projectId)
          .eq("owner_id", input.userId);
      }
    }
  }

  return {
    status,
    previewUrl,
    externalUrl,
    providerLevel: row.provider_level ?? null,
    logs,
    error: row.error ?? null,
  };
}

export async function getPreviewSession(input: {
  writer: Writer;
  userId: string;
  sessionId: string;
}) {
  const { data } = await input.writer
    .from("preview_sessions" as never)
    .select("*")
    .eq("id", input.sessionId)
    .eq("owner_id", input.userId)
    .maybeSingle();
  return data;
}

export async function getLatestPreviewSession(input: {
  writer: Writer;
  userId: string;
  projectId: string;
}) {
  const { data } = await input.writer
    .from("preview_sessions" as never)
    .select("*")
    .eq("project_id", input.projectId)
    .eq("owner_id", input.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}
