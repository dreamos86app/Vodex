import type { PublishedSnapshotFile } from "@/lib/publish/published-snapshot";

export type PreviewRenderEntry =
  | { kind: "html"; content: string }
  | { kind: "react"; content: string; path: string }
  | null;

export function pickPreviewEntry(files: PublishedSnapshotFile[]): PreviewRenderEntry {
  const html = files.find((f) => f.path === "index.html" || f.path.endsWith("/index.html"));
  if (html?.content) return { kind: "html", content: html.content };

  const page =
    files.find((f) => /\/page\.(tsx|jsx)$/i.test(f.path)) ||
    files.find((f) => /^app\/page\.(tsx|jsx)$/i.test(f.path)) ||
    files.find((f) => /page\.(tsx|jsx)$/i.test(f.path));
  if (page?.content) return { kind: "react", content: page.content, path: page.path };

  return null;
}

/** Strip obvious secret patterns from snapshot before preview. */
export function stripSecretsFromFiles(files: PublishedSnapshotFile[]): PublishedSnapshotFile[] {
  const secretRe = /(SUPABASE_SERVICE_ROLE|STRIPE_SECRET|OPENAI_API_KEY|sk_live_|sk_test_)/i;
  return files.map((f) => {
    if (!secretRe.test(f.content)) return f;
    return {
      ...f,
      content: f.content.replace(
        /(SUPABASE_SERVICE_ROLE|STRIPE_SECRET|OPENAI_API_KEY)\s*=\s*["'][^"']+["']/gi,
        "$1=[REDACTED]",
      ),
    };
  });
}
