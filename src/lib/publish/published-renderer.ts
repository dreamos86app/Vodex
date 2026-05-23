import type { PublishedSnapshotFile } from "@/lib/publish/published-snapshot";
import { pickPreviewEntry } from "@/lib/preview/preview-sandbox";
import { resolveSnapshotHtml } from "@/lib/publish/render-published-html";

export type PublishedRenderPlan = {
  title: string;
  description: string | null;
  publicUrl: string;
  version: number;
  entry: ReturnType<typeof pickPreviewEntry>;
  html: string | null;
  fileCount: number;
};

export function planPublishedRender(input: {
  title: string;
  description: string | null;
  publicUrl: string;
  version: number;
  files: PublishedSnapshotFile[];
}): PublishedRenderPlan {
  return {
    title: input.title,
    description: input.description,
    publicUrl: input.publicUrl,
    version: input.version,
    entry: pickPreviewEntry(input.files),
    html: resolveSnapshotHtml(input.files),
    fileCount: input.files.length,
  };
}
