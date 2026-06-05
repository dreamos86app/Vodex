import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { verifyBuildArtifact } from "@/lib/mobile/mobile-build-pipeline";
import { sanitizeMobileBuildLog } from "@/lib/mobile/secrets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  jobId: z.string().uuid(),
  builderId: z.string().min(1),
  buildType: z.enum(["apk", "aab"]),
  storagePath: z.string().min(1),
  byteSize: z.number().int().nonnegative(),
  logs: z.string().optional(),
  errorMessage: z.string().optional(),
});

function verifyBuilderAuth(req: NextRequest): boolean {
  const expected = process.env.ANDROID_BUILDER_SECRET?.trim();
  if (!expected) return false;
  const header = req.headers.get("x-builder-secret");
  return header === expected;
}

export async function POST(req: NextRequest) {
  if (!verifyBuilderAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Service role unavailable" }, { status: 503 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { jobId, builderId, buildType, storagePath, byteSize, logs, errorMessage } = parsed.data;

  const { data: job } = await admin
    .from("mobile_build_jobs" as never)
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const jobRow = job as {
    id: string;
    status: string;
    build_type?: string | null;
    artifact_type?: string | null;
  };

  if (errorMessage?.trim()) {
    await admin
      .from("mobile_build_jobs" as never)
      .update({
        status: "failed",
        error_message: errorMessage.slice(0, 2000),
        logs: sanitizeMobileBuildLog(logs ?? errorMessage),
        builder_id: builderId,
        completed_at: new Date().toISOString(),
        meta: {
          build_success: false,
          artifact_verified: false,
          callback_at: new Date().toISOString(),
        },
      } as never)
      .eq("id", jobId);

    return NextResponse.json({ ok: true, buildSuccess: false, reason: errorMessage });
  }

  const { data: blob, error: dlErr } = await admin.storage.from("media").download(storagePath);
  if (dlErr || !blob) {
    await admin
      .from("mobile_build_jobs" as never)
      .update({
        status: "failed",
        error_message: dlErr?.message ?? "Artifact download failed",
        builder_id: builderId,
        completed_at: new Date().toISOString(),
        meta: { build_success: false, artifact_verified: false },
      } as never)
      .eq("id", jobId);
    return NextResponse.json({ error: "Artifact not found in storage" }, { status: 400 });
  }

  const buffer = Buffer.from(await blob.arrayBuffer());
  const { data: signed } = await admin.storage.from("media").createSignedUrl(storagePath, 60 * 60 * 24 * 7);
  const downloadUrl = signed?.signedUrl ?? null;

  const verification = verifyBuildArtifact({
    buffer,
    storagePath,
    downloadUrl,
    artifactType: buildType,
  });

  if (byteSize > 0 && buffer.length !== byteSize) {
    verification.verified = false;
    verification.reason = `Byte size mismatch: reported ${byteSize}, actual ${buffer.length}`;
  }

  const buildSuccess = verification.verified;
  const status = buildSuccess ? "success" : "failed";

  await admin
    .from("mobile_build_jobs" as never)
    .update({
      status,
      build_type: buildType,
      artifact_type: buildType,
      artifact_url: downloadUrl,
      logs: sanitizeMobileBuildLog(
        [
          logs ?? "",
          verification.verified
            ? `Binary verified (${verification.byteSize} bytes).`
            : `Binary verification failed: ${verification.reason}`,
        ]
          .filter(Boolean)
          .join("\n"),
      ),
      error_message: buildSuccess ? null : verification.reason,
      builder_id: builderId,
      completed_at: new Date().toISOString(),
      meta: {
        storage_path: storagePath,
        artifact_byte_size: verification.byteSize,
        artifact_verified: verification.verified,
        build_success: buildSuccess,
        callback_at: new Date().toISOString(),
        expected_build_type: jobRow.build_type ?? jobRow.artifact_type,
      },
    } as never)
    .eq("id", jobId);

  return NextResponse.json({
    ok: true,
    buildSuccess,
    artifactVerified: verification.verified,
    artifactByteSize: verification.byteSize,
    jobId,
  });
}
