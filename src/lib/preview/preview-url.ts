import { getAppUrl } from "@/lib/app-url";

/** In-app preview route — not a fake external URL. */
export function buildPreviewPageUrl(previewSessionId: string): string {
  const base = getAppUrl().replace(/\/$/, "");
  return `${base}/preview/${previewSessionId}`;
}
