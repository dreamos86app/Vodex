import { previewFrameUrlWithRoute } from "@/lib/preview/rewrite-preview-artifact-html";

/** Iframe src for project preview — HTML is served by the API, never inlined in React state. */
export function projectPreviewFrameUrl(
  projectId: string,
  cacheBust?: number | string,
  route?: string | null,
  artifactBuildId?: string | null,
): string {
  return previewFrameUrlWithRoute(projectId, cacheBust, route, artifactBuildId);
}

export { previewFrameUrlWithRoute };

export type ProjectPreviewStatus = {
  ready: boolean;
  previewRenderable: boolean;
  fileCount: number;
  archetypeId?: string | null;
  previewHtmlLength: number;
  blockedReason?: string | null;
};
