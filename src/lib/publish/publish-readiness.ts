import { validateGeneratedApp } from "@/lib/build/generated-app-validator";
import { reviewGeneratedUi, uiQualityBlocksGenerated } from "@/lib/generation/generated-ui-review";
import { readCreateFlowConfig } from "@/lib/create/create-flow-config";
import { stripSecretsFromFiles } from "@/lib/preview/preview-sandbox";
import { pickPreviewEntry } from "@/lib/preview/preview-sandbox";
import { resolveSnapshotHtml } from "@/lib/publish/render-published-html";
import { slugifyAppName, isReservedPublishSlug, validateCustomSlug } from "@/lib/publish/app-slug";
import { buildPublicUrl } from "@/lib/publish/public-url";
import { rejectBannedRefs } from "@/lib/ai/file-fingerprint";

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

  const validation = validateGeneratedApp({
    files: safeFiles,
    projectId: input.projectId,
    ownerId: input.ownerId,
    routeMap: input.routeMap ?? null,
  });
  if (!validation.ok) {
    blockers.push(`Validation failed: ${validation.reasons.slice(0, 3).join(", ")}`);
  }
  if (validation.placeholderDetected) {
    blockers.push("Placeholder content detected — replace before publish");
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
  const uiQualityOk = !uiQualityBlocksGenerated(uiReview);
  if (!uiQualityOk) {
    blockers.push(`UI quality gate failed (score ${uiReview.overall})`);
  }

  const previewReady =
    input.metadata.preview_ready === true && input.metadata.preview_honest === true;
  if (!previewReady) {
    blockers.push("Start a successful preview before publishing");
  }

  const entry = pickPreviewEntry(safeFiles);
  const html = resolveSnapshotHtml(safeFiles);
  const routeRenderable = Boolean(entry && html);
  if (!routeRenderable) {
    blockers.push("Public route not renderable — no valid page snapshot");
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
        : "app",
    );
    slugValid = !isReservedPublishSlug(slug);
    if (!slugValid) blockers.push("Default slug is reserved — choose a custom slug");
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
  };
}
