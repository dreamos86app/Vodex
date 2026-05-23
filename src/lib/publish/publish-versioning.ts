import type { SupabaseClient } from "@supabase/supabase-js";
import { capturePublishedSnapshot } from "@/lib/publish/published-snapshot";
import { buildPublicUrl } from "@/lib/publish/public-url";
import { lifecyclePatch } from "@/lib/projects/project-lifecycle";
import { stripSecretsFromFiles } from "@/lib/preview/preview-sandbox";
import { checkPublishReadiness } from "@/lib/publish/publish-readiness";

type Writer = SupabaseClient;

export type PublishVersionRow = {
  version: number;
  slug: string;
  status: string;
  public_url: string;
  published_at: string | null;
  build_snapshot_id: string | null;
  id?: string;
};

async function insertVersionRow(
  writer: Writer,
  input: {
    publishedAppId: string;
    projectId: string;
    userId: string;
    version: number;
    slug: string;
    publicUrl: string;
    buildSnapshotId: string;
    title: string;
    description: string | null;
    files: Array<{ path: string; content: string }>;
  },
) {
  await (writer as SupabaseClient)
    .from("published_app_versions" as never)
    .upsert(
      {
        published_app_id: input.publishedAppId,
        project_id: input.projectId,
        owner_id: input.userId,
        version: input.version,
        slug: input.slug,
        public_url: input.publicUrl,
        build_snapshot_id: input.buildSnapshotId,
        title: input.title,
        description: input.description,
        snapshot_files: stripSecretsFromFiles(input.files),
        created_at: new Date().toISOString(),
      } as never,
      { onConflict: "project_id,version" },
    );
}

export async function listPublishVersions(
  writer: Writer,
  projectId: string,
  userId: string,
): Promise<PublishVersionRow[]> {
  const { data: project } = await writer
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (!project) return [];

  const { data: versionRows } = await (writer as SupabaseClient)
    .from("published_app_versions" as never)
    .select("id, version, slug, public_url, build_snapshot_id, created_at")
    .eq("project_id", projectId)
    .order("version", { ascending: false });

  if (versionRows?.length) {
    return (versionRows as Array<Record<string, unknown>>).map((r) => ({
      id: r.id as string,
      version: r.version as number,
      slug: r.slug as string,
      status: "published",
      public_url: r.public_url as string,
      published_at: r.created_at as string,
      build_snapshot_id: r.build_snapshot_id as string | null,
    }));
  }

  const { data } = await (writer as SupabaseClient)
    .from("published_apps" as never)
    .select("id, version, slug, status, public_url, published_at, build_snapshot_id")
    .eq("project_id", projectId)
    .order("version", { ascending: false });

  return (data ?? []) as PublishVersionRow[];
}

export async function unpublishProject(input: {
  writer: Writer;
  userId: string;
  projectId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: project } = await input.writer
    .from("projects")
    .select("id, metadata, published_subdomain")
    .eq("id", input.projectId)
    .eq("owner_id", input.userId)
    .maybeSingle();
  if (!project) return { ok: false, error: "Project not found" };

  const now = new Date().toISOString();
  const prevMeta =
    project.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
      ? (project.metadata as Record<string, unknown>)
      : {};

  const slug = project.published_subdomain?.trim();
  if (slug) {
    await (input.writer as SupabaseClient)
      .from("published_apps" as never)
      .update({ status: "unpublished", updated_at: now } as never)
      .eq("slug", slug);
  }

  await input.writer
    .from("projects")
    .update({
      status: "draft",
      preview_url: null,
      metadata: {
        ...prevMeta,
        ...lifecyclePatch("publish_ready", {
          unpublished_at: now,
          public_url: null,
          published: false,
          active_publish_version: null,
        }),
      },
    } as never)
    .eq("id", input.projectId);

  return { ok: true };
}

export async function republishNewVersion(input: {
  writer: Writer;
  userId: string;
  projectId: string;
}): Promise<
  | { ok: true; version: number; publicUrl: string; slug: string }
  | { ok: false; error: string; code?: string }
> {
  const { data: pub } = await (input.writer as SupabaseClient)
    .from("published_apps" as never)
    .select("id, slug, version, status")
    .eq("project_id", input.projectId)
    .maybeSingle();

  const pubRow = pub as { id?: string; slug?: string; version?: number; status?: string } | null;
  const slug = pubRow?.slug;
  if (!slug) return { ok: false, error: "App was never published", code: "never_published" };

  const { data: project } = await input.writer
    .from("projects")
    .select("metadata")
    .eq("id", input.projectId)
    .eq("owner_id", input.userId)
    .maybeSingle();

  const prevMeta =
    project?.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
      ? (project.metadata as Record<string, unknown>)
      : {};

  const snapshot = await capturePublishedSnapshot(input.writer, input.projectId, input.userId);
  const safeFiles = stripSecretsFromFiles(snapshot.files);

  const readiness = checkPublishReadiness({
    files: safeFiles,
    projectId: input.projectId,
    ownerId: input.userId,
    metadata: prevMeta,
    customSlug: slug,
  });
  if (!readiness.ok) {
    return { ok: false, error: readiness.blockers[0] ?? "Not ready to republish", code: "not_publish_ready" };
  }

  const version = (typeof pubRow?.version === "number" ? pubRow.version : 0) + 1;
  const { url } = buildPublicUrl(slug);
  const now = new Date().toISOString();
  const buildSnapshotId = `${input.projectId}-v${version}`;

  await (input.writer as SupabaseClient)
    .from("published_apps" as never)
    .upsert(
      {
        project_id: input.projectId,
        owner_id: input.userId,
        slug,
        public_url: url,
        status: "published",
        version,
        build_snapshot_id: buildSnapshotId,
        title: snapshot.title,
        description: snapshot.description,
        snapshot_files: safeFiles,
        published_at: now,
        updated_at: now,
      } as never,
      { onConflict: "slug" },
    );

  if (pubRow?.id) {
    await insertVersionRow(input.writer, {
      publishedAppId: pubRow.id,
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
      preview_url: url,
      metadata: {
        ...prevMeta,
        public_url: url,
        published: true,
        active_publish_version: version,
        published_at: now,
      },
    } as never)
    .eq("id", input.projectId)
    .eq("owner_id", input.userId);

  return { ok: true, version, publicUrl: url, slug };
}

export async function rollbackPublishVersion(input: {
  writer: Writer;
  userId: string;
  projectId: string;
  version: number;
}): Promise<{ ok: true; version: number; publicUrl: string } | { ok: false; error: string }> {
  const { data: row } = await (input.writer as SupabaseClient)
    .from("published_app_versions" as never)
    .select("*")
    .eq("project_id", input.projectId)
    .eq("version", input.version)
    .maybeSingle();

  const v = row as {
    slug?: string;
    public_url?: string;
    snapshot_files?: Array<{ path: string; content: string }>;
    title?: string;
    description?: string | null;
    build_snapshot_id?: string;
  } | null;

  if (!v?.slug || !v.public_url) return { ok: false, error: "Version not found" };

  const now = new Date().toISOString();
  await (input.writer as SupabaseClient)
    .from("published_apps" as never)
    .update({
      version: input.version,
      public_url: v.public_url,
      snapshot_files: stripSecretsFromFiles(v.snapshot_files ?? []),
      title: v.title,
      description: v.description,
      status: "published",
      build_snapshot_id: v.build_snapshot_id,
      updated_at: now,
    } as never)
    .eq("project_id", input.projectId);

  const { data: project } = await input.writer
    .from("projects")
    .select("metadata")
    .eq("id", input.projectId)
    .maybeSingle();
  const prevMeta =
    project?.metadata && typeof project.metadata === "object" && !Array.isArray(project.metadata)
      ? (project.metadata as Record<string, unknown>)
      : {};

  await input.writer
    .from("projects")
    .update({
      preview_url: v.public_url,
      metadata: {
        ...prevMeta,
        public_url: v.public_url,
        active_publish_version: input.version,
        published: true,
      },
    } as never)
    .eq("id", input.projectId)
    .eq("owner_id", input.userId);

  return { ok: true, version: input.version, publicUrl: v.public_url };
}

export { insertVersionRow };
