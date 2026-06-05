import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { ensurePrivateBucket } from "@/lib/supabase/ensure-storage-bucket";
import { extractAndAnalyzeZip } from "@/lib/import/zip-import-service";
import { detectAppIconFromImport } from "@/lib/import/detect-app-icon";
import { ensureProjectIconSvg } from "@/lib/projects/ensure-project-icon";
import { buildProjectBannerSvg } from "@/lib/projects/build-project-banner-svg";
import {
  ZIP_IMPORT_BUCKET,
  ZIP_IMPORT_ALLOWED_MIMES,
  ZIP_IMPORT_MAX_BYTES,
  ZIP_IMPORT_UPLOAD_LIMITS,
  buildZipImportStoragePath,
  formatImportStorageError,
  importStorageNotConfiguredUserMessage,
  importStorageSetupDetail,
  isStorageBucketMissingError,
} from "@/lib/import/zip-storage";
import { zipTooLargeErrorPayload } from "@/lib/import/zip-import-limits";
import { previewZipBillingDiagnostics } from "@/lib/imports/zip-preview-billing";
import {
  buildZipImportAppFileRows,
  ZIP_IMPORT_APP_FILE_INSERT_KEYS,
} from "@/lib/projects/app-file-rows";
import {
  formatZipImportFailure,
  type ZipImportFailureStep,
} from "@/lib/import/zip-import-diagnostics";
import { lifecyclePatch } from "@/lib/projects/project-lifecycle";
import type { Json } from "@/lib/supabase/types";
import { runProjectPreviewBuild } from "@/lib/imports/run-project-preview-build";
import { loadPreviewWorkerStatus } from "@/lib/preview/preview-worker-status";
import {
  estimateZipPreviewCreditsWithPlatformMultiplier,
  reserveZipPreviewActionCredits,
  refundZipPreviewActionCredits,
  captureZipPreviewActionCredits,
} from "@/lib/imports/zip-preview-action-credits";
import { frameworkNeedsWorkerBuild } from "@/lib/imports/preview-build-queue";
import type { DetectedFrameworkId } from "@/lib/imports/framework-detector";
import {
  buildImportedRouteManifest,
  mergeRouteManifestIntoMetadata,
} from "@/lib/preview/imported-app-route-manifest";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = ZIP_IMPORT_MAX_BYTES;
const FY_REMOVE = /[^a-z0-9-]/g;

function slugFromName(name: string): string {
  const base = name
    .replace(/\.[^/.]+$/, "")
    .toLowerCase()
    .replace(FY_REMOVE, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return base || "imported-app";
}

const APP_FILES_BATCH_SIZE = 100;

async function upsertAppFilesBatched(
  client: ReturnType<typeof createSupabaseAdmin>,
  rows: ReturnType<typeof buildZipImportAppFileRows>,
): Promise<{ ok: true } | { ok: false; message: string; batchIndex: number }> {
  for (let i = 0; i < rows.length; i += APP_FILES_BATCH_SIZE) {
    const batch = rows.slice(i, i + APP_FILES_BATCH_SIZE);
    const { error } = await client.from("app_files").upsert(batch, {
      onConflict: "project_id,path",
    });
    if (error) {
      return { ok: false, message: error.message, batchIndex: i / APP_FILES_BATCH_SIZE };
    }
  }
  return { ok: true };
}

async function rollbackImport(args: {
  admin: ReturnType<typeof createSupabaseAdmin>;
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  projectId: string;
  storagePath: string;
}) {
  await args.admin.storage.from(ZIP_IMPORT_BUCKET).remove([args.storagePath]).catch(() => {});
  await args.supabase.from("projects").delete().eq("id", args.projectId).eq("owner_id", args.userId);
}

function importFail(
  step: ZipImportFailureStep,
  rawMessage: string,
  extra?: { insertPayloadKeys?: string[]; projectId?: string },
  status = 500,
) {
  return NextResponse.json(
    formatZipImportFailure({
      step,
      rawMessage,
      insertPayloadKeys: extra?.insertPayloadKeys,
      projectId: extra?.projectId,
    }),
    { status },
  );
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing "file" field' }, { status: 400 });
  }

  const nameField = form.get("name");
  const displayName =
    typeof nameField === "string" && nameField.trim().length > 0 ? nameField.trim() : null;

  const lower = file.name.toLowerCase();
  if (!lower.endsWith(".zip")) {
    return NextResponse.json({ error: "Only .zip archives are supported" }, { status: 400 });
  }
  const mime = file.type;
  if (mime && mime !== "application/zip" && mime !== "application/x-zip-compressed") {
    return NextResponse.json({ error: `Unsupported MIME type: ${mime}` }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(zipTooLargeErrorPayload(), { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const extracted = await extractAndAnalyzeZip(buf);
  if (!extracted.ok) {
    return NextResponse.json({ error: extracted.error }, { status: 400 });
  }

  const worker = await loadPreviewWorkerStatus();
  const detectedFrameworkId = extracted.validation.framework.id as DetectedFrameworkId;
  const needsWorker = frameworkNeedsWorkerBuild(detectedFrameworkId);
  if (needsWorker && !worker.connected) {
    return NextResponse.json(
      {
        error: "Preview Worker Not Connected",
        code: "PREVIEW_WORKER_NOT_CONNECTED",
        hint:
          "This project requires the Preview Runtime Worker. Deploy or reconnect the worker before importing ZIP projects.",
        workerUnavailableMessage:
          "ZIP builds cannot run on Vercel serverless. Start npm run preview-worker:dev locally or deploy worker/preview-worker.",
      },
      { status: 503 },
    );
  }

  const creditEstimate = await estimateZipPreviewCreditsWithPlatformMultiplier({
    sizeBytes: buf.length,
    fileCount: extracted.files.length,
    frameworkId: extracted.validation.framework.id,
    frameworkLabel: extracted.validation.framework.label,
    dependencyCount: extracted.validation.dependencies.dependencyCount,
  });

  const { files, validation, rejectedSecrets, rejectedPaths } = extracted;
  const baseSlug = slugFromName(file.name);
  const slug = `${baseSlug}-${Date.now().toString(36)}`;
  const defaultTitle = baseSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const frameworkId = detectedFrameworkId;

  const lifecycleStatus = "imported";
  const importPaths = files.map((f) => f.path);
  const importEntryFile =
    importPaths.find((p) => /\.html?$/i.test(p)) ??
    importPaths.find((p) => p === "index.html") ??
    importPaths[0] ??
    null;

  const icon = detectAppIconFromImport(files, displayName ?? defaultTitle);
  const displayTitle = displayName ?? defaultTitle;
  const iconSvg = ensureProjectIconSvg(displayTitle, icon.svg);
  const routeManifest = buildImportedRouteManifest(files, "zip_import");
  const discoveredRoutes = routeManifest.paths.length ? routeManifest.paths : validation.routes;
  const bannerSvg = buildProjectBannerSvg({
    title: displayTitle,
    framework: frameworkId === "unknown" ? "nextjs" : frameworkId,
    fileCount: files.length,
    routeCount: validation.routes.length,
    kind: "imported",
  });

  const { data: project, error: projErr } = await supabase
    .from("projects")
    .insert({
      owner_id: user.id,
      name: displayTitle,
      slug,
      status: validation.previewReady ? "draft" : "draft",
      build_status: "imported",
      framework: frameworkId === "unknown" ? "nextjs" : frameworkId,
      icon_svg: iconSvg,
      metadata: mergeRouteManifestIntoMetadata(
        {
        source: "zip_import",
        lifecycle_status: lifecycleStatus,
        icon_source: icon.source,
        icon_path: icon.path ?? null,
        banner_svg: bannerSvg,
        import: {
          original_name: file.name,
          file_count: files.length,
          framework: validation.framework,
          routes: discoveredRoutes,
          scripts: validation.scripts,
          package_manager: validation.packageManager,
          dependencies: {
            production_count: validation.dependencies.production.length,
            has_supabase: validation.dependencies.hasSupabase,
            has_stripe: validation.dependencies.hasStripe,
            has_tailwind: validation.dependencies.hasTailwind,
          },
          env_requirements: validation.envRequirements
            .filter((e) => !e.key.startsWith("BASE44_") || validation.legacy.usesBase44Sdk)
            .map((e) => e.key),
          legacy_platform: validation.legacy.platform,
          legacy_base44_sdk: validation.legacy.usesBase44Sdk,
          quality_score: validation.qualityScore,
          preview_ready: false,
          publish_ready: false,
          entry_file: importEntryFile,
          prepared_at: new Date().toISOString(),
          warnings: validation.warnings,
          rejected_secrets: rejectedSecrets,
          rejected_paths: rejectedPaths,
        },
        preview_ready: false,
        preview_honest: false,
        ...lifecyclePatch(lifecycleStatus),
      },
        routeManifest,
      ) as Json,
    } as never)
    .select("id")
    .single();

  if (projErr || !project?.id) {
    return NextResponse.json(
      { error: projErr?.message ?? "Could not create project" },
      { status: 500 },
    );
  }

  const projectId = project.id;
  const storagePath = buildZipImportStoragePath(user.id, projectId, file.name);

  let admin;
  try {
    admin = createSupabaseAdmin();
  } catch (e) {
    await supabase.from("projects").delete().eq("id", projectId).eq("owner_id", user.id);
    const msg = e instanceof Error ? e.message : "Server configuration error";
    return NextResponse.json(
      {
        error: importStorageNotConfiguredUserMessage(),
        code: "IMPORT_STORAGE_NOT_CONFIGURED",
        adminDetail: importStorageSetupDetail(),
        hint: msg,
      },
      { status: 503 },
    );
  }

  const bucket = await ensurePrivateBucket(admin, ZIP_IMPORT_BUCKET, {
    fileSizeLimit: ZIP_IMPORT_MAX_BYTES,
    allowedMimeTypes: [...ZIP_IMPORT_ALLOWED_MIMES],
  });
  if (!bucket.ok) {
    await supabase.from("projects").delete().eq("id", projectId).eq("owner_id", user.id);
    const storageErr = isStorageBucketMissingError(bucket.error)
      ? formatImportStorageError(bucket.error)
      : {
          error: importStorageNotConfiguredUserMessage(),
          code: "IMPORT_STORAGE_NOT_CONFIGURED" as const,
          adminDetail: importStorageSetupDetail(),
          rawMessage: bucket.error,
        };
    return NextResponse.json(
      {
        ...storageErr,
        hint: bucket.hint,
      },
      { status: 503 },
    );
  }

  const { error: upErr } = await admin.storage.from(ZIP_IMPORT_BUCKET).upload(storagePath, buf, {
    contentType: "application/zip",
    upsert: true,
  });
  if (upErr) {
    await supabase.from("projects").delete().eq("id", projectId).eq("owner_id", user.id);
    if (isStorageBucketMissingError(upErr.message)) {
      return NextResponse.json(formatImportStorageError(upErr.message), { status: 503 });
    }
    return NextResponse.json(
      {
        error: importStorageNotConfiguredUserMessage(),
        code: "IMPORT_STORAGE_NOT_CONFIGURED",
        adminDetail: importStorageSetupDetail(),
        hint: upErr.message,
      },
      { status: 503 },
    );
  }

  const rows = buildZipImportAppFileRows(projectId, user.id, files);

  const filesResult = await upsertAppFilesBatched(admin, rows);
  if (!filesResult.ok) {
    await rollbackImport({ admin, supabase, userId: user.id, projectId, storagePath });
    return importFail("app_files_upsert", filesResult.message, {
      insertPayloadKeys: [...ZIP_IMPORT_APP_FILE_INSERT_KEYS],
      projectId,
    });
  }

  const { error: importedErr } = await supabase.from("imported_projects").insert({
    user_id: user.id,
    project_id: projectId,
    source_archive_path: storagePath,
    framework_detected: frameworkId,
    meta: {
      bucket: ZIP_IMPORT_BUCKET,
      storage_path: storagePath,
      original_name: file.name,
      quality_score: validation.qualityScore,
      routes: validation.routes,
      scan_stats: extracted.stats,
    } as Json,
  });
  if (importedErr) {
    await rollbackImport({ admin, supabase, userId: user.id, projectId, storagePath });
    return importFail("imported_projects_insert", importedErr.message, { projectId }, 503);
  }

  const reserve =
    creditEstimate.estimatedActionCredits > 0
      ? await reserveZipPreviewActionCredits({
          userId: user.id,
          projectId,
          estimate: creditEstimate,
        })
      : { ok: true as const, operationId: "", credits: 0 };

  if (!reserve.ok) {
    await rollbackImport({ admin, supabase, userId: user.id, projectId, storagePath });
    return NextResponse.json(
      {
        error: reserve.error,
        code: reserve.code === "insufficient" ? "insufficient_action_credits" : "zip_credit_reserve_failed",
      },
      { status: reserve.code === "insufficient" ? 402 : 500 },
    );
  }

  let previewBuild: Awaited<ReturnType<typeof runProjectPreviewBuild>> | null = null;
  try {
    previewBuild = await runProjectPreviewBuild({
      admin,
      writer: supabase,
      userId: user.id,
      projectId,
      creditEstimate,
    });
  } catch (e) {
    console.error("[import-zip] preview build failed:", e);
    await refundZipPreviewActionCredits({
      userId: user.id,
      projectId,
      reason: "preview_build_exception",
    });
  }

  const diagnostics = previewBuild?.diagnostics;
  const previewReady = diagnostics?.previewRenderable === true;

  if (previewReady) {
    await captureZipPreviewActionCredits({ userId: user.id, projectId });
  } else if (diagnostics?.previewStatus === "queued") {
    /* Worker will capture on success; hold stays reserved. */
  } else {
    await refundZipPreviewActionCredits({
      userId: user.id,
      projectId,
      reason: diagnostics?.blockedReason ?? "preview_not_renderable",
    });
  }
  const publishReady = previewReady && diagnostics?.sourceIntegrityOk === true;

  const billing = previewZipBillingDiagnostics(creditEstimate, reserve.ok ? "reserved" : "none");

  return NextResponse.json({
    ...ZIP_IMPORT_UPLOAD_LIMITS,
    projectId,
    fileCount: files.length,
    scanStats: extracted.stats,
    estimatedAiCostUsd: 0,
    creditEstimate,
    actionCreditsReserved: reserve.credits,
    workerConnected: worker.connected,
    aiRepairOptional: true,
    framework: diagnostics?.framework ?? frameworkId,
    frameworkLabel: diagnostics?.frameworkLabel ?? validation.framework.label,
    qualityScore: validation.qualityScore,
    previewReady,
    publishReady,
    previewStatus: diagnostics?.previewStatus ?? "failed",
    blockedReason: diagnostics?.blockedReason ?? null,
    previewUrl: diagnostics?.previewUrl ?? null,
    diagnostics,
    jobId: previewBuild?.jobId ?? null,
    previewBilling: billing,
    routes: validation.routes,
    warnings: [...validation.warnings, ...(diagnostics?.warnings ?? [])],
    rejectedSecrets,
    redirectTo: `/apps/${projectId}/dashboard?imported=1`,
    alsoCreate: `/create?projectId=${projectId}&mode=build`,
  });
}
