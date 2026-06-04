import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractAndAnalyzeZip } from "@/lib/import/zip-import-service";
import { estimateZipPreviewCreditsWithPlatformMultiplier } from "@/lib/imports/zip-preview-action-credits";
import { getActionCreditAvailability } from "@/lib/action-credits/get-action-credit-availability";
import { loadPreviewWorkerStatus } from "@/lib/preview/preview-worker-status";

export const runtime = "nodejs";

const MAX_PREVIEW_BYTES = 25 * 1024 * 1024;

/** POST — analyze ZIP without creating a project (review step). */
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
  if (!file.name.toLowerCase().endsWith(".zip")) {
    return NextResponse.json({ error: "Only .zip archives are supported" }, { status: 400 });
  }
  if (file.size > MAX_PREVIEW_BYTES) {
    return NextResponse.json({ error: "ZIP too large for preview scan" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const extracted = await extractAndAnalyzeZip(buf);
  if (!extracted.ok) {
    return NextResponse.json({ error: extracted.error }, { status: 400 });
  }

  const { validation, rejectedSecrets, rejectedPaths } = extracted;
  const creditEstimate = await estimateZipPreviewCreditsWithPlatformMultiplier({
    sizeBytes: buf.length,
    fileCount: extracted.files.length,
    frameworkId: validation.framework.id,
    frameworkLabel: validation.framework.label,
  });
  const worker = await loadPreviewWorkerStatus();
  const actionCredits = await getActionCreditAvailability(user.id, {
    actionType: "zip_preview_build",
  });
  const actionCreditsRequired = creditEstimate.estimatedActionCredits;
  const actionCreditsSufficient = actionCredits.totalAvailable >= actionCreditsRequired;

  return NextResponse.json({
    fileCount: extracted.files.length,
    scanStats: extracted.stats,
    estimatedAiCostUsd: 0,
    aiRepairOptional: true,
    fileTree: extracted.files.slice(0, 80).map((f) => f.path),
    framework: validation.framework,
    routes: validation.routes,
    scripts: validation.scripts,
    packageManager: validation.packageManager,
    dependencies: {
      production: validation.dependencies.production.slice(0, 20),
      dev: validation.dependencies.dev.slice(0, 15),
      integrations: {
        supabase: validation.dependencies.hasSupabase,
        stripe: validation.dependencies.hasStripe,
        firebase: validation.dependencies.hasFirebase,
        prisma: validation.dependencies.hasPrisma,
        tailwind: validation.dependencies.hasTailwind,
      },
    },
    envRequirements: validation.envRequirements,
    qualityScore: validation.qualityScore,
    previewReady: validation.previewReady,
    publishReady: validation.publishReady,
    warnings: validation.warnings,
    blockers: validation.blockers,
    rejectedSecrets,
    rejectedPaths: rejectedPaths.slice(0, 20),
    creditEstimate,
    actionCreditBalance: actionCredits.totalAvailable,
    actionCreditsSufficient,
    actionCreditsRequired,
    workerConnected: worker.connected,
    workerUnavailableMessage: worker.connected
      ? null
      : "Preview Worker Not Connected — deploy or start the preview worker before importing ZIP projects.",
  });
}
