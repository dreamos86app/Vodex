/**
 * Single source of truth for builder, preview, and publish gates.
 * All UIs should derive phase + blockers from this module (or /api/projects/[id]/status).
 */
import { validateGeneratedApp } from "@/lib/build/generated-app-validator";
import { filterRenderableBuildFiles } from "@/lib/build/generated-file-utils";
import { evaluateSourceIntegrity } from "@/lib/build/source-integrity-validator";
import { MIN_RENDERABLE_FILES } from "@/lib/build/build-success-contract";
import { readLifecycleFromMetadata } from "@/lib/projects/project-lifecycle";

export type CanonicalBuildPhase =
  | "draft_created"
  | "planning"
  | "building"
  | "files_persisted"
  | "source_integrity_passed"
  | "preview_ready"
  | "published";

export type ReadinessCheckStatus = "pass" | "warn" | "fail";

export type CanonicalBuildState = {
  phase: CanonicalBuildPhase;
  fileCount: number;
  renderableFileCount: number;
  sourceIntegrityOk: boolean;
  validationOk: boolean;
  previewReady: boolean;
  previewHonest: boolean;
  canClaimFilesSaved: boolean;
  canPreview: boolean;
  canPublish: boolean;
  blockers: string[];
  warnings: string[];
  checks: {
    files: ReadinessCheckStatus;
    packageJson: ReadinessCheckStatus;
    mainPage: ReadinessCheckStatus;
    sourceIntegrity: ReadinessCheckStatus;
    preview: ReadinessCheckStatus;
    routes: ReadinessCheckStatus;
  };
};

function readFileCountFromMeta(meta: Record<string, unknown>): number {
  if (typeof meta.file_count === "number") return meta.file_count;
  if (typeof meta.generated_file_count === "number") return meta.generated_file_count;
  return 0;
}

/** Derive canonical lifecycle phase from persisted rows + metadata. */
export function computeCanonicalBuildState(input: {
  metadata: Record<string, unknown>;
  buildStatus?: string | null;
  publishedSubdomain?: string | null;
  previewUrl?: string | null;
  files: Array<{ path: string; content: string }>;
  projectId: string;
  ownerId: string;
  buildJobStatus?: string | null;
}): CanonicalBuildState {
  const meta = input.metadata;
  const { lifecycle_status } = readLifecycleFromMetadata(meta);
  const renderable = filterRenderableBuildFiles(input.files);
  const fileCount = Math.max(renderable.length, readFileCountFromMeta(meta));
  const buildStatus = String(input.buildStatus ?? meta.build_status ?? "").toLowerCase();
  const jobStatus = String(input.buildJobStatus ?? "").toLowerCase();
  const published = Boolean(input.publishedSubdomain?.trim());

  const validation = validateGeneratedApp({
    files: renderable,
    projectId: input.projectId,
    ownerId: input.ownerId,
    routeMap: Array.isArray(meta.blueprint_routes) ? (meta.blueprint_routes as string[]) : null,
  });

  const integrity = evaluateSourceIntegrity(renderable);

  const hasPackage = renderable.some(
    (f) => f.path === "package.json" || f.path.endsWith("/package.json"),
  );
  const hasPage =
    renderable.some((f) => /page\.(tsx|jsx|js|html)$/i.test(f.path)) ||
    renderable.some((f) => /\/(page|pages)\//i.test(f.path));

  const previewReady =
    (meta.preview_ready === true && meta.preview_honest === true) ||
    Boolean(input.previewUrl?.trim() && meta.preview_renderable === true);
  const previewFailed =
    meta.files_ready_preview_failed === true || buildStatus === "preview_failed";

  const sourceIntegrityOk =
    meta.source_integrity_ok === true || integrity.sourceIntegrityOk;
  const filesPersisted = fileCount > 0 || renderable.length > 0;

  const building =
    jobStatus === "running" ||
    jobStatus === "starting" ||
    jobStatus === "queued" ||
    buildStatus === "running" ||
    buildStatus === "building" ||
    lifecycle_status === "building" ||
    lifecycle_status === "build_queued" ||
    lifecycle_status === "blueprint_generating";

  const planning =
    lifecycle_status === "intent_review" ||
    lifecycle_status === "blueprint_ready" ||
    lifecycle_status === "blueprint_approved";

  let phase: CanonicalBuildPhase = "draft_created";
  if (published || lifecycle_status === "published") {
    phase = "published";
  } else if (previewReady && sourceIntegrityOk && validation.ok) {
    phase = "preview_ready";
  } else if (sourceIntegrityOk && filesPersisted) {
    phase = "source_integrity_passed";
  } else if (filesPersisted) {
    phase = "files_persisted";
  } else if (building) {
    phase = "building";
  } else if (planning) {
    phase = "planning";
  }

  const blockers: string[] = [];
  const warnings: string[] = [];

  if (fileCount === 0) blockers.push("No generated files");
  if (!hasPackage) blockers.push("Missing package.json");
  if (!hasPage) blockers.push("No main page");
  if (!sourceIntegrityOk) {
    const reason =
      typeof meta.blocked_reason === "string"
        ? meta.blocked_reason
        : integrity.blockedReason ?? "Source integrity failed";
    blockers.push(reason.replace(/_/g, " "));
  }
  if (previewFailed && !previewReady) blockers.push("Preview failed — repair required");
  if (!previewReady && sourceIntegrityOk && validation.ok) {
    blockers.push("Successful preview required before publish");
  }
  if (!validation.ok) {
    for (const r of validation.reasons.slice(0, 3)) {
      if (r === "no_files") continue;
      warnings.push(r.replace(/_/g, " "));
    }
  }

  const canClaimFilesSaved = sourceIntegrityOk && fileCount >= MIN_RENDERABLE_FILES;
  const canPreview = canClaimFilesSaved && validation.ok;
  const canPublish = canPreview && previewReady && !previewFailed;

  const check = (ok: boolean, warn?: boolean): ReadinessCheckStatus =>
    ok ? "pass" : warn ? "warn" : "fail";

  return {
    phase,
    fileCount,
    renderableFileCount: renderable.length,
    sourceIntegrityOk,
    validationOk: validation.ok,
    previewReady,
    previewHonest: meta.preview_honest === true,
    canClaimFilesSaved,
    canPreview,
    canPublish,
    blockers: [...new Set(blockers)],
    warnings,
    checks: {
      files: check(fileCount > 0),
      packageJson: check(hasPackage),
      mainPage: check(hasPage),
      sourceIntegrity: check(sourceIntegrityOk),
      preview: previewReady ? "pass" : previewFailed ? "fail" : check(false, filesPersisted),
      routes: check(hasPage, !hasPage && fileCount > 0),
    },
  };
}
