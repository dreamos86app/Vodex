import { buildStaticPreviewHtml } from "@/lib/preview/static-preview-builder";
import type { PublishedSnapshotFile } from "@/lib/publish/published-snapshot";
import { pickPreviewEntry } from "@/lib/preview/preview-sandbox";

/** Resolve HTML for iframe preview from published/preview snapshot files. */
export function resolveSnapshotHtml(files: PublishedSnapshotFile[]): string | null {
  const entry = pickPreviewEntry(files);
  if (!entry) return null;
  if (entry.kind === "html") return entry.content;
  return buildStaticPreviewHtml(files);
}
