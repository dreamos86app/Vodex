import type { SupabaseClient } from "@supabase/supabase-js";

const SHIM_HINT_PATHS = ["package.json", ".env.example", "vite.config.ts", "index.html"] as const;

export type PreviewShimHint = { path: string; content: string; sizeBytes: number };

/** Load app_files hints for preview shims (Base44/Lovable/Vite env stubs). */
export async function loadPreviewShimHints(
  supabase: SupabaseClient,
  projectId: string,
): Promise<PreviewShimHint[]> {
  const hints: PreviewShimHint[] = [];
  for (const hintPath of SHIM_HINT_PATHS) {
    const { data: hintRow } = await supabase
      .from("app_files")
      .select("content")
      .eq("project_id", projectId)
      .eq("path", hintPath)
      .maybeSingle();
    if (hintRow?.content) {
      hints.push({
        path: hintPath,
        content: hintRow.content,
        sizeBytes: Buffer.byteLength(hintRow.content, "utf8"),
      });
    }
  }
  return hints;
}

export function defaultPreviewShimHints(): PreviewShimHint[] {
  return [{ path: "package.json", content: "{}", sizeBytes: 2 }];
}
