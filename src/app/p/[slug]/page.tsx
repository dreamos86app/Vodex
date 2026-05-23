import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { PublicAppRenderer } from "@/components/publish/public-app-renderer";
import { planPublishedRender } from "@/lib/publish/published-renderer";
import { stripSecretsFromFiles } from "@/lib/preview/preview-sandbox";
import { publicAppBadgeEnabled } from "@/lib/publish/publish-config";
import type { PublishedSnapshotFile } from "@/lib/publish/published-snapshot";

export const dynamic = "force-dynamic";

type PublishedRow = {
  project_id: string;
  slug: string;
  public_url: string;
  status: string;
  title: string | null;
  description: string | null;
  snapshot_files: PublishedSnapshotFile[] | null;
  version: number;
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const admin = createServiceRoleClient();
  if (!admin) return { title: "App not found" };
  const { data } = (await admin
    .from("published_apps" as never)
    .select("title, description, status")
    .eq("slug", slug.trim().toLowerCase())
    .maybeSingle()) as { data: { title?: string; description?: string; status?: string } | null };

  if (!data || data.status !== "published") {
    return { title: "App not published", description: "This app is not publicly available." };
  }
  return {
    title: data.title ?? slug,
    description: data.description ?? "Published app on DreamOS86",
  };
}

export default async function PublicAppPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const safe = slug?.trim().toLowerCase();
  if (!safe) notFound();

  const admin = createServiceRoleClient();
  if (!admin) notFound();

  const { data: published } = (await admin
    .from("published_apps" as never)
    .select("project_id, slug, public_url, status, title, description, snapshot_files, version")
    .eq("slug", safe)
    .maybeSingle()) as { data: PublishedRow | null };

  if (!published || published.status !== "published") {
    notFound();
  }

  if (!published.public_url?.startsWith("http")) {
    notFound();
  }

  const files: PublishedSnapshotFile[] = stripSecretsFromFiles(
    Array.isArray(published.snapshot_files) ? published.snapshot_files : [],
  );

  if (files.length === 0) {
    notFound();
  }

  const plan = planPublishedRender({
    title: published.title ?? published.slug,
    description: published.description,
    publicUrl: published.public_url,
    version: published.version,
    files,
  });

  if (!plan.html) {
    notFound();
  }

  return (
    <PublicAppRenderer
      title={plan.title}
      description={plan.description}
      publicUrl={plan.publicUrl}
      files={files}
      version={plan.version}
      showBadge={publicAppBadgeEnabled()}
    />
  );
}
