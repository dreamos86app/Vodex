import { validateGeneratedApp } from "@/lib/build/generated-app-validator";
import { reviewGeneratedUi, uiQualityBlocksGenerated } from "@/lib/generation/generated-ui-review";
import { readCreateFlowConfig } from "@/lib/create/create-flow-config";
import { stripSecretsFromFiles } from "@/lib/preview/preview-sandbox";
import { pickPreviewEntry } from "@/lib/preview/preview-sandbox";
import { slugifyAppName, isReservedPublishSlug, validateCustomSlug } from "@/lib/publish/app-slug";
import { buildPublicUrl } from "@/lib/publish/public-url";
import { rejectBannedRefs } from "@/lib/ai/file-fingerprint";
import { isZipImportProject, readImportMeta } from "@/lib/projects/imported-project-state";
import {
  findPlaceholderFindings,
  isRawPlaceholderValidatorReason,
  placeholderBlockerMessage,
  type PlaceholderFinding,
} from "@/lib/publish/placeholder-findings";

export type PublishReadinessResult = {
  ok: boolean;
  blockers: string[];
  warnings: string[];
  slug: string | null;
  slugValid: boolean;
  publicUrl: string | null;
  previewReady: boolean;
  validationOk: boolean;
  uiQualityOk: boolean;
  secretsOk: boolean;
  routeRenderable: boolean;
  uiQualityScore: number;
  snapshotExists: boolean;
  placeholderFindings: PlaceholderFinding[];
};

function hasSecrets(content: string): boolean {
  if (/service_role|SUPABASE_SERVICE|sk_live_|sk-proj-/i.test(content)) return true;
  const banned = rejectBannedRefs(content);
  return Boolean(banned);
}

/** Full publish readiness gate — no fake published state. */
export function checkPublishReadiness(input: {
  files: Array<{ path: string; content: string }>;
  projectId: string;
  ownerId: string;
  metadata: Record<string, unknown>;
  buildStatus?: string | null;
  routeMap?: string[] | null;
  customSlug?: string | null;
}): PublishReadinessResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (input.files.length === 0) {
    blockers.push("No generated app files yet");
  }

  const safeFiles = stripSecretsFromFiles(input.files);
  const combined = safeFiles.map((f) => f.content).join("\n");
  const secretsOk = !hasSecrets(combined);
  if (!secretsOk) blockers.push("Secrets detected in generated files — remove before publish");

  const placeholderFindings = findPlaceholderFindings(safeFiles);
  const isImport = isZipImportProject(input.metadata);

  const validation = validateGeneratedApp({
    files: safeFiles,
    projectId: input.projectId,
    ownerId: input.ownerId,
    routeMap: input.routeMap ?? null,
  });

  const userSafeValidationReasons = validation.reasons.filter(
    (r) => !isRawPlaceholderValidatorReason(r),
  );
  if (!isImport && !validation.ok && userSafeValidationReasons.length > 0) {
    const friendly = userSafeValidationReasons
      .slice(0, 3)
      .map((r) => {
        if (r === "no_files") return "No app files yet";
        if (r === "no_page_route") return "No main page found";
        if (r === "missing_package_json") return "Missing package.json";
        return r.replace(/_/g, " ");
      })
      .join("; ");
    blockers.push(friendly);
  }

  if (placeholderFindings.length > 0 || validation.placeholderDetected) {
    if (!isImport) {
      blockers.push(placeholderBlockerMessage(placeholderFindings));
    } else {
      warnings.push("Imported source may contain TODO markers — review before going live");
    }
  }

  const createCfg = readCreateFlowConfig(input.metadata);
  const appType =
    typeof input.metadata.app_type === "string"
      ? input.metadata.app_type
      : typeof input.metadata.blueprint_app_type === "string"
        ? input.metadata.blueprint_app_type
        : null;
  const routeMap = input.routeMap ?? (Array.isArray(input.metadata.blueprint_routes) ? (input.metadata.blueprint_routes as string[]) : null);

  const uiReview = reviewGeneratedUi({
    files: safeFiles,
    appType,
    stylePresetId: createCfg.stylePresetId,
    routeMap,
  });
  const uiQualityOk = isImport || !uiQualityBlocksGenerated(uiReview);
  if (!uiQualityOk) {
    blockers.push(`UI quality gate failed (score ${uiReview.overall})`);
  }

  const importMeta = isImport ? readImportMeta(input.metadata) : null;
  const previewFailedWithFiles =
    input.metadata.files_ready_preview_failed === true ||
    (input.buildStatus ?? "").toLowerCase() === "preview_failed";
  const importPreviewValidated =
    isImport &&
    input.metadata.preview_renderable === true &&
    input.metadata.preview_honest === true;
  const previewReady =
    (input.metadata.preview_ready === true && input.metadata.preview_honest === true) ||
    importPreviewValidated;
  if (previewFailedWithFiles && !previewReady) {
    const previewFailureKind =
      typeof input.metadata.preview_failure_kind === "string"
        ? input.metadata.preview_failure_kind
        : null;
    const previewErr =
      typeof input.metadata.preview_error === "string" ? input.metadata.preview_error : null;
    blockers.push(
      previewFailureKind && previewFailureKind !== "true_incomplete_files"
        ? `Preview build failed — ${previewErr ?? previewFailureKind.replace(/_/g, " ")}`
        : previewFailureKind === "true_incomplete_files"
          ? "Generated files are incomplete — repair source before publishing."
          : "Preview build failed — repair before publishing.",
    );
  } else if (!previewReady && !isImport) {
    blockers.push("Start a successful preview before publishing");
  } else if (!previewReady && isImport) {
    blockers.push(
      "Imported app preview is not ready — open the builder and fix the entry file or dependencies",
    );
  }

  const entry = pickPreviewEntry(safeFiles);
  const routeRenderable = isImport
    ? safeFiles.length > 0
    : Boolean(
        entry &&
          (entry.kind === "html"
            ? entry.content.length > 200 && !/no renderable content/i.test(entry.content)
            : safeFiles.some(
                (f) => /page\.(tsx|jsx)$/i.test(f.path) && f.content.trim().length > 80,
              )),
      );
  if (!routeRenderable) {
    blockers.push(
      isImport
        ? "Imported files not loaded — open Code to verify import"
        : "Public route not renderable — no valid page snapshot",
    );
  }

  let slug: string | null = null;
  let slugValid = false;
  if (input.customSlug?.trim()) {
    const v = validateCustomSlug(input.customSlug);
    slug = v.slug;
    slugValid = v.ok;
    if (!v.ok) blockers.push(v.error === "reserved_slug" ? "Slug is reserved" : "Invalid slug");
  } else {
    slug = slugifyAppName(
      typeof input.metadata.app_name === "string"
        ? input.metadata.app_name
        : isImport && typeof (readImportMeta(input.metadata).original_name) === "string"
          ? readImportMeta(input.metadata).original_name!
          : "app",
    );
    slugValid = !isReservedPublishSlug(slug);
    if (!slugValid && !isImport) blockers.push("Default slug is reserved — choose a custom slug");
    else if (!slugValid && isImport) warnings.push("Default slug is reserved — choose a custom slug in settings");
  }

  const { url } = slug ? buildPublicUrl(slug) : { url: "" };
  const publicUrl = url?.startsWith("http") ? url : null;
  if (slug && !publicUrl) blockers.push("Public URL could not be generated");

  const snapshotExists = safeFiles.length > 0;
  if (!snapshotExists) blockers.push("Publish snapshot is empty");

  return {
    ok: blockers.length === 0,
    blockers,
    warnings,
    slug,
    slugValid,
    publicUrl,
    previewReady,
    validationOk: validation.ok,
    uiQualityOk,
    secretsOk,
    routeRenderable,
    uiQualityScore: uiReview.overall,
    snapshotExists,
    placeholderFindings,
  };
}
