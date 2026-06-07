import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  filterRenderableBuildFiles,
  isHiddenGeneratedPath,
} from "@/lib/build/generated-file-utils";
import { countComponentFiles } from "@/lib/build/import-graph";
import { MIN_RENDERABLE_FILES } from "@/lib/build/build-success-contract";
import { requiredPageSlugsForArchetype } from "@/lib/build/post-build-contract";

type Writer = SupabaseClient<Database>;

export type AssertBuildFilesPersistedInput = {
  writer: Writer;
  projectId: string;
  archetypeId?: string | null;
  minFiles?: number;
  minComponents?: number;
};

export type AssertBuildFilesPersistedResult = {
  ok: boolean;
  code?: string;
  fileCount: number;
  componentCount: number;
  failures: string[];
};

function mainRoutePath(paths: string[]): string | null {
  return (
    paths.find((p) => /^app\/page\.(tsx|jsx|js)$/i.test(p.replace(/\\/g, "/"))) ?? null
  );
}

function requiredSlugsMissing(pathsLower: string[], slugs: string[]): string[] {
  const blob = pathsLower.join("\n");
  return slugs.filter((slug) => {
    const s = slug.replace(/^\//, "").toLowerCase();
    if (s === "dashboard" || s === "home") {
      return !pathsLower.some(
        (p) => /(^|\/)app\/page\.(tsx|jsx|js)$/i.test(p) || /dashboard/i.test(p),
      );
    }
    return !(
      pathsLower.some((p) => p.includes(`app/${s}/page.`)) ||
      blob.includes(`app/${s}/page`) ||
      blob.includes(s)
    );
  });
}

/** Re-read app_files after upsert — hard gate before preview-ready / publish. */
export async function assertBuildFilesPersisted(
  input: AssertBuildFilesPersistedInput,
): Promise<AssertBuildFilesPersistedResult> {
  const minFiles = input.minFiles ?? MIN_RENDERABLE_FILES;
  /** Small valid apps often ship 2–3 shared components; pages carry the rest. */
  const minComponents = input.minComponents ?? 2;
  const failures: string[] = [];
  const writer = (createServiceRoleClient() ?? input.writer) as Writer;

  const { data: rows, error } = await writer
    .from("app_files")
    .select("path, content")
    .eq("project_id", input.projectId)
    .limit(300);

  if (error) {
    return {
      ok: false,
      code: "files_persistence_failed",
      fileCount: 0,
      componentCount: 0,
      failures: [`db_read:${error.message}`],
    };
  }

  const visible = (rows ?? []).filter(
    (r) => r.path && !isHiddenGeneratedPath(r.path),
  ) as Array<{ path: string; content: string }>;

  const renderable = filterRenderableBuildFiles(
    visible.map((r) => ({ path: r.path, content: r.content ?? "" })),
  );
  const pathsLower = renderable.map((f) => f.path.toLowerCase());
  const componentCount = countComponentFiles(renderable);

  if (renderable.length < minFiles) {
    failures.push(`persisted_files_${renderable.length}_lt_${minFiles}`);
  }
  if (componentCount < minComponents) {
    failures.push(`persisted_components_${componentCount}_lt_${minComponents}`);
  }

  const slugs =
    input.archetypeId === "restaurant_inventory"
      ? requiredPageSlugsForArchetype("restaurant_inventory")
      : null;
  if (slugs?.length) {
    const missing = requiredSlugsMissing(pathsLower, slugs);
    for (const slug of missing) {
      failures.push(`missing_route_${slug}`);
    }
  }

  const mainPath = mainRoutePath(renderable.map((f) => f.path));
  const mainFile = mainPath
    ? renderable.find((f) => f.path.replace(/\\/g, "/") === mainPath)
    : renderable.find((f) => /(^|\/)app\/page\.(tsx|jsx|js)$/i.test(f.path));
  if (!mainFile?.content?.trim()) {
    failures.push("main_route_empty");
  } else if (mainFile.content.trim().length < 40) {
    failures.push("main_route_too_short");
  }

  return {
    ok: failures.length === 0,
    code: failures.length ? "files_persistence_failed" : undefined,
    fileCount: renderable.length,
    componentCount,
    failures,
  };
}
