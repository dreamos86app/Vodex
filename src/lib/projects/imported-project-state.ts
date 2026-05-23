import {
  type ProjectLifecycleStatus,
  readLifecycleFromMetadata,
  legacyProjectStatus,
  isLifecycleStatus,
} from "@/lib/projects/project-lifecycle";

export type ImportedLifecycleStatus =
  | "importing"
  | "imported"
  | "imported_needs_setup"
  | "imported_preview_ready"
  | "imported_error";

export type ImportMeta = {
  original_name?: string;
  file_count?: number;
  framework?: { id?: string; label?: string };
  routes?: string[];
  quality_score?: number;
  preview_ready?: boolean;
  env_requirements?: string[];
  warnings?: string[];
};

export function isZipImportProject(metadata: unknown): boolean {
  const m = readLifecycleFromMetadata(metadata);
  if (m.source === "zip_import") return true;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  const imp = (metadata as Record<string, unknown>).import;
  return imp != null && typeof imp === "object";
}

export function readImportMeta(metadata: unknown): ImportMeta {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const imp = (metadata as Record<string, unknown>).import;
  if (!imp || typeof imp !== "object" || Array.isArray(imp)) return {};
  const o = imp as Record<string, unknown>;
  return {
    original_name: typeof o.original_name === "string" ? o.original_name : undefined,
    file_count: typeof o.file_count === "number" ? o.file_count : undefined,
    framework:
      o.framework && typeof o.framework === "object"
        ? (o.framework as ImportMeta["framework"])
        : undefined,
    routes: Array.isArray(o.routes) ? (o.routes as string[]) : undefined,
    quality_score: typeof o.quality_score === "number" ? o.quality_score : undefined,
    preview_ready: Boolean(o.preview_ready),
    env_requirements: Array.isArray(o.env_requirements)
      ? (o.env_requirements as string[])
      : undefined,
    warnings: Array.isArray(o.warnings) ? (o.warnings as string[]) : undefined,
  };
}

export function resolveImportedLifecycleStatus(
  metadata: unknown,
  fileCount: number,
  envConfigured: boolean,
): ImportedLifecycleStatus | null {
  if (!isZipImportProject(metadata)) return null;
  const imp = readImportMeta(metadata);
  const needsEnv = (imp.env_requirements?.length ?? 0) > 0 && !envConfigured;
  if (fileCount === 0) return "imported_error";
  if (needsEnv) return "imported_needs_setup";
  if (imp.preview_ready) return "imported_preview_ready";
  return "imported";
}

export function importedStatusLabel(status: ImportedLifecycleStatus): string {
  switch (status) {
    case "importing":
      return "Importing";
    case "imported":
      return "Imported";
    case "imported_needs_setup":
      return "Needs setup";
    case "imported_preview_ready":
      return "Preview ready";
    case "imported_error":
      return "Import error";
    default:
      return "Imported";
  }
}

/** User-facing badge for Your Apps cards. */
export function projectCardBadge(metadata: unknown, lifecycle?: string | null): string {
  if (isZipImportProject(metadata)) {
    const imp = readImportMeta(metadata);
    const st = resolveImportedLifecycleStatus(metadata, imp.file_count ?? 0, false);
    if (st) return importedStatusLabel(st);
    return "Imported ZIP";
  }
  if (lifecycle && isLifecycleStatus(lifecycle)) {
    if (lifecycle === "preview_ready") return "Preview ready";
    if (lifecycle === "published") return "Published";
    if (lifecycle === "generated") return "Ready";
  }
  return "App";
}

/** Legacy projects.status for imported apps — not "staging". */
export function legacyStatusForProject(metadata: unknown, lifecycle: ProjectLifecycleStatus): "live" | "staging" | "draft" | "building" | "error" {
  if (isZipImportProject(metadata)) {
    const imp = readImportMeta(metadata);
    const st = resolveImportedLifecycleStatus(metadata, imp.file_count ?? 0, false);
    if (st === "imported_error") return "error";
    if (st === "imported_needs_setup") return "draft";
    if (st === "imported_preview_ready") return "live";
    return "staging";
  }
  return legacyProjectStatus(lifecycle);
}

/** Whether publish/readiness should treat project as build-complete without build_jobs row. */
export function isBuildCompleteForProject(input: {
  metadata: unknown;
  fileCount: number;
  buildJobStatus?: string | null;
  projectBuildStatus?: string | null;
}): boolean {
  if (input.fileCount <= 0) return false;
  if (isZipImportProject(input.metadata)) return true;
  const bs = input.buildJobStatus ?? input.projectBuildStatus ?? "";
  return bs === "completed" || bs === "succeeded";
}

export function preferredEntryFile(paths: string[]): string | null {
  const prefs = [
    "package.json",
    "src/App.tsx",
    "src/App.jsx",
    "src/main.tsx",
    "src/main.ts",
    "app/page.tsx",
    "index.html",
  ];
  for (const p of prefs) {
    if (paths.includes(p)) return p;
  }
  return paths[0] ?? null;
}
