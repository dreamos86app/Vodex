import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { stripSecretsFromFiles } from "@/lib/preview/preview-sandbox";
import { resolveSnapshotHtml } from "@/lib/publish/render-published-html";
import type { PublishedSnapshotFile } from "@/lib/publish/published-snapshot";

export const dynamic = "force-dynamic";

export default async function PreviewPage({ params }: { params: Promise<{ previewId: string }> }) {
  const { previewId } = await params;
  const id = previewId?.trim();
  if (!id) notFound();

  const admin = createServiceRoleClient();
  if (!admin) notFound();

  const { data: session } = await admin
    .from("preview_sessions" as never)
    .select("id, status, snapshot_files, error, expires_at, provider_level, external_url")
    .eq("id", id)
    .maybeSingle();

  const row = session as {
    status?: string;
    snapshot_files?: PublishedSnapshotFile[];
    error?: string | null;
    expires_at?: string | null;
    provider_level?: string | null;
    external_url?: string | null;
  } | null;

  if (!row) notFound();

  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-2xl bg-surface p-6 text-center ring-1 ring-border">
          <p className="text-[15px] font-semibold">Preview expired</p>
          <p className="mt-2 text-[13px] text-muted-foreground">
            Start a new preview from your app dashboard.
          </p>
        </div>
      </div>
    );
  }

  if (row.status !== "ready") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-2xl bg-surface p-6 text-center ring-1 ring-border">
          <p className="text-[15px] font-semibold">Preview unavailable</p>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {row.error ?? "Session not ready. Start preview from your app dashboard."}
          </p>
        </div>
      </div>
    );
  }

  if (row.external_url?.startsWith("http")) {
    return (
      <iframe
        title="Hosted preview"
        src={row.external_url}
        className="h-screen w-full border-0"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    );
  }

  const files = stripSecretsFromFiles(Array.isArray(row.snapshot_files) ? row.snapshot_files : []);
  const html = resolveSnapshotHtml(files);

  if (!html) notFound();

  return (
    <iframe
      title="App preview"
      srcDoc={html}
      className="h-screen w-full border-0"
      sandbox="allow-scripts allow-same-origin"
    />
  );
}
