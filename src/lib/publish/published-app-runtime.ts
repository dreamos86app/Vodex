import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { downloadPreviewArtifactFile } from "@/lib/imports/preview-artifact-writer";
import { stripSecretsFromFiles } from "@/lib/preview/preview-sandbox";
import { planPublishedRender } from "@/lib/publish/published-renderer";
import { rewritePublishedArtifactHtml } from "@/lib/publish/rewrite-published-artifact-html";
import { buildPublishedErrorPage } from "@/lib/publish/published-error-page";
import {
  injectPublishedWatermark,
  type WatermarkEntitlement,
} from "@/lib/publish/watermark-runtime";
import type { PublishedSnapshotFile } from "@/lib/publish/published-snapshot";
import { getEntitlements } from "@/lib/billing/plan-entitlements";
import { normalizePlanId } from "@/lib/billing/plans";

export type PublishedAppRecord = {
  id: string;
  project_id: string;
  owner_id: string;
  slug: string;
  public_url: string;
  canonical_url: string | null;
  artifact_path: string | null;
  artifact_build_id: string | null;
  status: string;
  title: string | null;
  description: string | null;
  snapshot_files: PublishedSnapshotFile[];
  version: number;
  watermark_disabled: boolean;
  render_verified: boolean;
};

export type PublishedRenderResult = {
  html: string;
  source: "artifact" | "snapshot" | "error";
  statusCode: number;
  diagnostics: string[];
  renderVerified: boolean;
};

export function normalizePublishedRoute(pathSegments: string[] | undefined): string {
  if (!pathSegments?.length) return "/";
  const joined = `/${pathSegments.join("/")}`.replace(/\/+/g, "/");
  return joined.length > 1 && joined.endsWith("/") ? joined.slice(0, -1) : joined;
}

export async function loadPublishedAppBySlug(
  slug: string,
  admin?: SupabaseClient | null,
): Promise<PublishedAppRecord | null> {
  const client = admin ?? createServiceRoleClient();
  if (!client) return null;

  const safe = slug.trim().toLowerCase();
  const { data } = (await client
    .from("published_apps" as never)
    .select(
      "id, project_id, owner_id, slug, public_url, canonical_url, artifact_path, artifact_build_id, status, title, description, snapshot_files, version, watermark_disabled, render_verified",
    )
    .eq("slug", safe)
    .maybeSingle()) as { data: Record<string, unknown> | null };

  if (!data || data.status !== "published") return null;

  const files = stripSecretsFromFiles(
    Array.isArray(data.snapshot_files)
      ? (data.snapshot_files as PublishedSnapshotFile[])
      : [],
  );

  return {
    id: String(data.id),
    project_id: String(data.project_id),
    owner_id: String(data.owner_id),
    slug: String(data.slug),
    public_url: String(data.public_url ?? ""),
    canonical_url: (data.canonical_url as string | null) ?? null,
    artifact_path: (data.artifact_path as string | null) ?? null,
    artifact_build_id: (data.artifact_build_id as string | null) ?? null,
    status: String(data.status),
    title: (data.title as string | null) ?? null,
    description: (data.description as string | null) ?? null,
    snapshot_files: files,
    version: Number(data.version ?? 1),
    watermark_disabled: data.watermark_disabled === true,
    render_verified: data.render_verified === true,
  };
}

export async function loadPublishedAppByCustomHost(
  hostname: string,
  admin?: SupabaseClient | null,
): Promise<PublishedAppRecord | null> {
  const client = admin ?? createServiceRoleClient();
  if (!client) return null;

  const host = hostname.trim().toLowerCase();
  const { data: domainRow } = (await client
    .from("custom_domains" as never)
    .select("project_id, status")
    .eq("hostname", host)
    .eq("status", "active")
    .maybeSingle()) as { data: { project_id?: string; status?: string } | null };

  if (!domainRow?.project_id) return null;

  const { data } = (await client
    .from("published_apps" as never)
    .select(
      "id, project_id, owner_id, slug, public_url, canonical_url, artifact_path, artifact_build_id, status, title, description, snapshot_files, version, watermark_disabled, render_verified",
    )
    .eq("project_id", domainRow.project_id)
    .eq("status", "published")
    .maybeSingle()) as { data: Record<string, unknown> | null };

  if (!data) return null;
  return loadPublishedAppBySlug(String(data.slug), client);
}

async function resolveOwnerWatermarkEntitlement(
  admin: SupabaseClient,
  ownerId: string,
  watermarkDisabled: boolean,
): Promise<WatermarkEntitlement> {
  const { data: profile } = await admin
    .from("profiles")
    .select("plan_id")
    .eq("id", ownerId)
    .maybeSingle();

  const planId = normalizePlanId((profile as { plan_id?: string } | null)?.plan_id ?? "free");
  const tier = getEntitlements(planId).tier;
  return { planTier: tier, watermarkDisabled };
}

export async function resolvePublishedAppHtml(input: {
  published: PublishedAppRecord;
  routePath?: string;
  admin?: SupabaseClient | null;
}): Promise<PublishedRenderResult> {
  const admin = input.admin ?? createServiceRoleClient();
  const route = input.routePath?.trim() || "/";
  const diagnostics: string[] = [];

  if (!admin) {
    return {
      html: buildPublishedErrorPage({
        title: "Service unavailable",
        message: "Published app runtime is temporarily unavailable.",
        slug: input.published.slug,
      }),
      source: "error",
      statusCode: 503,
      diagnostics: ["service_role_missing"],
      renderVerified: false,
    };
  }

  const watermarkEnt = await resolveOwnerWatermarkEntitlement(
    admin,
    input.published.owner_id,
    input.published.watermark_disabled,
  );

  let artifactPath = input.published.artifact_path?.trim() || null;
  if (!artifactPath) {
    const { data: projectRow } = await admin
      .from("projects")
      .select("metadata")
      .eq("id", input.published.project_id)
      .maybeSingle();
    const meta =
      projectRow?.metadata && typeof projectRow.metadata === "object" && !Array.isArray(projectRow.metadata)
        ? (projectRow.metadata as Record<string, unknown>)
        : {};
    const fromMeta =
      typeof meta.preview_artifact_path === "string" ? meta.preview_artifact_path.trim() : "";
    if (fromMeta) {
      artifactPath = fromMeta;
      diagnostics.push("artifact_from_project_metadata");
    }
  }

  if (artifactPath) {
    const file = await downloadPreviewArtifactFile({
      admin,
      artifactPath,
      relativePath: "index.html",
    });
    if (file?.data) {
      const raw = file.data.toString("utf8");
      if (raw.trim().length > 0) {
        let html = rewritePublishedArtifactHtml(raw, input.published.slug, route);
        html = injectPublishedWatermark(html, watermarkEnt);
        diagnostics.push("artifact_served", `route=${route}`);
        return {
          html,
          source: "artifact",
          statusCode: 200,
          diagnostics,
          renderVerified: true,
        };
      }
    }
    diagnostics.push("artifact_index_missing");
  }

  const files = input.published.snapshot_files;
  if (files.length === 0) {
    return {
      html: buildPublishedErrorPage({
        title: "App not ready",
        message: "This published app has no content yet. Republish from Vodex to fix.",
        slug: input.published.slug,
        diagnostics,
      }),
      source: "error",
      statusCode: 503,
      diagnostics: [...diagnostics, "empty_snapshot"],
      renderVerified: false,
    };
  }

  const plan = planPublishedRender({
    title: input.published.title ?? input.published.slug,
    description: input.published.description,
    publicUrl: input.published.public_url,
    version: input.published.version,
    files,
  });

  if (!plan.html?.trim()) {
    return {
      html: buildPublishedErrorPage({
        title: "App not renderable",
        message:
          "We could not render this app. Try republishing after a successful preview build.",
        slug: input.published.slug,
        diagnostics: [...diagnostics, "no_renderable_entry"],
      }),
      source: "error",
      statusCode: 503,
      diagnostics,
      renderVerified: false,
    };
  }

  let html = plan.html;
  if (route !== "/") {
    html = rewritePublishedArtifactHtml(html, input.published.slug, route);
  }
  html = injectPublishedWatermark(html, watermarkEnt);

  return {
    html,
    source: "snapshot",
    statusCode: 200,
    diagnostics: [...diagnostics, "snapshot_served"],
    renderVerified: true,
  };
}

export type PublishedHealthProbe = {
  ok: boolean;
  status: "ok" | "degraded" | "failed";
  slug: string;
  source?: "artifact" | "snapshot" | "error";
  renderVerified?: boolean;
  diagnostics: string[];
};

export async function probePublishedAppHealth(slug: string): Promise<PublishedHealthProbe> {
  const published = await loadPublishedAppBySlug(slug);
  if (!published) {
    return {
      ok: false,
      status: "failed",
      slug,
      diagnostics: ["not_found"],
    };
  }

  const result = await resolvePublishedAppHtml({ published, routePath: "/" });
  const ok = result.statusCode === 200 && result.renderVerified && result.source !== "error";

  return {
    ok,
    status: ok ? "ok" : result.source === "snapshot" ? "degraded" : "failed",
    slug,
    source: result.source,
    renderVerified: result.renderVerified,
    diagnostics: result.diagnostics,
  };
}

export async function markPublishedRenderVerified(
  slug: string,
  verified: boolean,
  admin?: SupabaseClient | null,
): Promise<void> {
  const client = admin ?? createServiceRoleClient();
  if (!client) return;
  await client
    .from("published_apps" as never)
    .update({ render_verified: verified, updated_at: new Date().toISOString() } as never)
    .eq("slug", slug.trim().toLowerCase());
}

/** Resolve slug from subdomain host like `reciplyy.vodex.app`. */
export function slugFromSubdomainHost(
  hostname: string,
  rootDomain: string,
): string | null {
  const host = hostname.trim().toLowerCase();
  const root = rootDomain.trim().toLowerCase();
  if (!host.endsWith(`.${root}`)) return null;
  const sub = host.slice(0, -(root.length + 1));
  if (!sub || sub.includes(".")) return null;
  return sub;
}
