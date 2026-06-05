import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { slugifyAppName, isReservedPublishSlug, validateCustomSlug } from "@/lib/publish/app-slug";
import { allocatePublishSubdomain, buildSlugCandidates } from "@/lib/publish/subdomain-allocator";
import { buildPublicUrl } from "@/lib/publish/public-url";
import { wildcardSubdomainEnabled } from "@/lib/publish/publish-config";
import {
  lifecyclePatch,
  normalizeProjectStatus,
  readLifecycleFromMetadata,
  type ProjectLifecycleStatus,
} from "@/lib/projects/project-lifecycle";
import { publicWebUrlForSubdomain } from "@/lib/publish/subdomain";
import { insertVersionRow } from "@/lib/publish/publish-versioning";
import { stripSecretsFromFiles } from "@/lib/preview/preview-sandbox";
import { capturePublishedSnapshot } from "@/lib/publish/published-snapshot";
import { checkPublishReadiness } from "@/lib/publish/publish-readiness";

type Writer = SupabaseClient<Database>;

export async function isSlugAvailable(
  writer: Writer,
  slug: string,
  excludeProjectId?: string,
): Promise<boolean> {
  const safe = slug.trim().toLowerCase();
  const { data: clashProj } = await writer
    .from("projects")
    .select("id")
    .eq("published_subdomain", safe)
    .maybeSingle();
  if (clashProj?.id && clashProj.id !== excludeProjectId) return false;

  const { data: clashPub } = await (writer as SupabaseClient)
    .from("published_apps" as never)
    .select("id, project_id, status")
    .eq("slug", safe)
    .maybeSingle()
    .then((r) => r, () => ({ data: null }));

  const pub = clashPub as { id?: string; project_id?: string; status?: string } | null;
  if (!pub) return true;
  if (pub.project_id === excludeProjectId) return true;
  if (pub.status === "unpublished") return true;
  return false;
}

export async function findUniquePublishSlug(
  writer: Writer,
  baseName: string,
  excludeProjectId?: string,
): Promise<string | null> {
  const candidates = buildSlugCandidates({
    appName: baseName,
    projectName: baseName,
    projectId: excludeProjectId ?? "00000000-0000-4000-8000-000000000000",
  });
  for (const candidate of candidates) {
    if (isReservedPublishSlug(candidate)) continue;
    if (await isSlugAvailable(writer, candidate, excludeProjectId)) return candidate;
  }
  return null;
}

export async function resolvePublishSlug(
  writer: Writer,
  input: {
    projectId: string;
    projectName: string;
    existingSubdomain?: string | null;
    customSlug?: string | null;
  },
): Promise<{ ok: true; slug: string } | { ok: false; error: string; code: string }> {
  if (input.existingSubdomain?.trim()) {
    const slug = input.existingSubdomain.trim().toLowerCase();
    if (await isSlugAvailable(writer, slug, input.projectId)) {
      return { ok: true, slug };
    }
  }

  if (input.customSlug?.trim()) {
    const v = validateCustomSlug(input.customSlug);
    if (!v.ok) {
      return {
        ok: false,
        error: v.error === "reserved_slug" ? "Slug is reserved" : "Invalid slug",
        code: v.error ?? "invalid_slug",
      };
    }
    if (!(await isSlugAvailable(writer, v.slug, input.projectId))) {
      return { ok: false, error: "Slug already taken", code: "slug_conflict" };
    }
    return { ok: true, slug: v.slug };
  }

  const slug = await findUniquePublishSlug(writer, input.projectName || "app", input.projectId);
  if (!slug) return { ok: false, error: "Could not allocate a unique public slug", code: "slug_conflict" };
  return { ok: true, slug };
}

export type PublishStartResult =
  | {
      ok: true;
      publicUrl: string;
      slug: string;
      mode: "subdomain" | "path";
      version: number;
      publishedAppId?: string;
      healthChecked?: boolean;
      healthAttempts?: number;
      publishedAt?: string;
    }
  | { ok: false; error: string; code: string; details?: { blockers: string[]; warnings?: string[] } };

export async function startPublish(input: {
  writer: Writer;
  userId: string;
  projectId: string;
  customSlug?: string | null;
}): Promise<PublishStartResult> {
  const { data: project } = await input.writer
    .from("projects")
    .select("id, name, slug, owner_id, metadata, published_subdomain, preview_url, build_status, app_name")
    .eq("id", input.projectId)
    .eq("owner_id", input.userId)
    .maybeSingle();

  if (!project) return { ok: false, error: "Project not found", code: "not_found" };

  const snapshot = await capturePublishedSnapshot(input.writer, input.projectId, input.userId);
  const safeFiles = stripSecretsFromFiles(snapshot.files);

  const prevMeta =
    project.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
      ? (project.metadata as Record<string, unknown>)
      : {};

  const routeMap = Array.isArray(prevMeta.blueprint_routes)
    ? (prevMeta.blueprint_routes as string[])
    : null;

  const readiness = checkPublishReadiness({
    files: safeFiles,
    projectId: input.projectId,
    ownerId: input.userId,
    metadata: prevMeta,
    buildStatus: project.build_status ?? null,
    routeMap,
    customSlug: input.customSlug,
  });

  if (!readiness.ok) {
    return {
      ok: false,
      error: readiness.blockers[0] ?? "Publish readiness checks failed",
      code: "not_publish_ready",
      details: { blockers: readiness.blockers, warnings: readiness.warnings },
    };
  }

  const meta = readLifecycleFromMetadata(project.metadata);
  const lifecycle = normalizeProjectStatus(
    {
      lifecycleStatus: meta.lifecycle_status,
      buildStatus: project.build_status,
      fileCount: safeFiles.length,
      hasActiveBuildJob: false,
      publishedSubdomain: project.published_subdomain,
      previewUrl: project.preview_url,
      blueprintApproved: meta.blueprint_approved,
    },
    project.metadata,
  );

  if (
    ![
      "generated",
      "preview_ready",
      "publish_ready",
      "published",
      "imported",
      "imported_preview_ready",
      "imported_needs_setup",
    ].includes(lifecycle)
  ) {
    return { ok: false, error: "App is not ready to publish yet.", code: "not_publish_ready" };
  }

  const allocated = await allocatePublishSubdomain(input.writer, {
    projectId: input.projectId,
    ownerId: input.userId,
    appName: project.app_name,
    projectName: project.name,
    projectSlug: project.slug,
    desiredSlug: input.customSlug,
  });

  if (!allocated.ok) {
    return {
      ok: false,
      error: allocated.message,
      code: allocated.code,
      details: { blockers: [allocated.message, allocated.debug ?? ""].filter(Boolean) },
    };
  }

  const slug = allocated.slug;

  const { url, mode } = buildPublicUrl(slug);
  if (!url?.startsWith("http")) {
    return { ok: false, error: "Public URL could not be generated", code: "no_public_url" };
  }

  const now = new Date().toISOString();

  const { data: prevPub } = await (input.writer as SupabaseClient)
    .from("published_apps" as never)
    .select("id, version")
    .eq("project_id", input.projectId)
    .maybeSingle()
    .then((r) => r, () => ({ data: null }));

  const version = ((prevPub as { version?: number } | null)?.version ?? 0) + 1;
  const buildSnapshotId = `${input.projectId}-v${version}`;

  const pubTable = input.writer.from("published_apps" as never);
  const { data: existingPub } = await pubTable
    .select("id, slug")
    .eq("project_id", input.projectId)
    .maybeSingle();

  const artifactPath =
    typeof prevMeta.preview_artifact_path === "string" ? prevMeta.preview_artifact_path.trim() : "";
  const artifactBuildId =
    typeof prevMeta.preview_artifact_build_id === "string"
      ? prevMeta.preview_artifact_build_id.trim()
      : artifactPath
        ? artifactPath.split("/").pop() ?? null
        : null;

  const { probePublishedAppHealth } = await import("@/lib/publish/published-app-runtime");

  const pubPayload = {
    project_id: input.projectId,
    owner_id: input.userId,
    slug,
    subdomain: wildcardSubdomainEnabled() ? slug : null,
    public_url: url,
    canonical_url: url,
    artifact_path: artifactPath || null,
    artifact_build_id: artifactBuildId,
    status: "published",
    version,
    build_snapshot_id: buildSnapshotId,
    title: snapshot.title,
    description: snapshot.description,
    snapshot_files: safeFiles,
    render_verified: false,
    published_at: now,
    updated_at: now,
  } as never;

  const existingRow = existingPub as { id?: string; slug?: string } | null;
  let publishedAppId: string | undefined;
  if (existingRow?.id) {
    const { data: updated, error: upErr } = await pubTable
      .update(pubPayload)
      .eq("id", existingRow.id)
      .select("id")
      .maybeSingle();
    if (upErr) {
      return { ok: false, error: upErr.message, code: "db_error" };
    }
    publishedAppId = (updated as { id?: string } | null)?.id;
  } else {
    const { data: inserted, error: insErr } = await pubTable.insert(pubPayload).select("id").maybeSingle();
    if (insErr) {
      const code = insErr.code === "23505" ? "slug_conflict" : "db_error";
      return {
        ok: false,
        error: insErr.code === "23505" ? "Slug already taken" : insErr.message,
        code,
      };
    }
    publishedAppId = (inserted as { id?: string } | null)?.id;
  }
  if (!publishedAppId) {
    return { ok: false, error: "Publish verification failed — no published_apps row", code: "publish_verify_failed" };
  }

  const { data: verifyPub } = await (input.writer as SupabaseClient)
    .from("published_apps" as never)
    .select("id, slug, public_url, status, snapshot_files, version")
    .eq("project_id", input.projectId)
    .maybeSingle();

  const verified = verifyPub as {
    id?: string;
    slug?: string;
    public_url?: string;
    status?: string;
    snapshot_files?: unknown[];
    version?: number;
  } | null;

  if (
    !verified ||
    verified.status !== "published" ||
    !verified.public_url?.startsWith("http") ||
    !Array.isArray(verified.snapshot_files) ||
    verified.snapshot_files.length === 0
  ) {
    return {
      ok: false,
      error: "Publish verification failed — snapshot or public URL missing",
      code: "publish_verify_failed",
    };
  }

  const healthProbe = await probePublishedAppHealth(slug);
  let healthAttempts = healthProbe.diagnostics.length || 1;
  if (!healthProbe.ok) {
    const { verifyPublishedUrlHealthWithRetry } = await import("@/lib/publish/publish-health-retry");
    const health = await verifyPublishedUrlHealthWithRetry(url);
    healthAttempts = health.attempts.length;
    if (!health.ok) {
      return {
        ok: false,
        error: `Publish health check failed after retries — ${health.error}`,
        code: "publish_health_failed",
      };
    }
  }

  if (publishedAppId) {
    await insertVersionRow(input.writer, {
      publishedAppId,
      projectId: input.projectId,
      userId: input.userId,
      version,
      slug,
      publicUrl: url,
      buildSnapshotId,
      title: snapshot.title,
      description: snapshot.description,
      files: safeFiles,
    });
  }

  await input.writer
    .from("projects")
    .update({
      published_subdomain: slug,
      status: "live",
      build_status: "completed",
      preview_url: url,
      metadata: {
        ...prevMeta,
        ...lifecyclePatch("published" as ProjectLifecycleStatus, {
          public_url: url,
          publish_mode: mode,
          wildcard_subdomain: wildcardSubdomainEnabled(),
          published_at: now,
          published: true,
          active_publish_version: version,
          preview_ready: true,
          preview_honest: true,
        }),
      },
    } as never)
    .eq("id", input.projectId)
    .eq("owner_id", input.userId);

  return {
    ok: true,
    publicUrl: url,
    slug,
    mode,
    version,
    publishedAppId,
    healthChecked: true,
    healthAttempts,
    publishedAt: now,
  };
}

export { resolveDisplayPublicUrl } from "@/lib/publish/publish-display-url";
