/**
 * Honest mobile build pipeline — success only when artifact is verified.
 */

export type MobileArtifactType = "wrapper_zip" | "apk" | "aab" | "ipa" | "xcarchive";

export type MobileBuildPipelineStatus =
  | "queued"
  | "running"
  | "success"
  | "failed"
  | "requires_builder_config"
  | "cancelled";

export type ArtifactVerification = {
  verified: boolean;
  byteSize: number;
  storagePath: string | null;
  downloadUrl: string | null;
  reason: string | null;
};

export function verifyBuildArtifact(input: {
  buffer: Buffer | null;
  storagePath: string | null;
  downloadUrl: string | null;
  artifactType: MobileArtifactType;
}): ArtifactVerification {
  const byteSize = input.buffer?.length ?? 0;
  if (!input.buffer || byteSize <= 0) {
    return {
      verified: false,
      byteSize: 0,
      storagePath: input.storagePath,
      downloadUrl: input.downloadUrl,
      reason: "Artifact buffer is empty",
    };
  }
  if (!input.storagePath?.trim()) {
    return {
      verified: false,
      byteSize,
      storagePath: null,
      downloadUrl: input.downloadUrl,
      reason: "Artifact was not uploaded to storage",
    };
  }
  if (!input.downloadUrl?.trim()) {
    return {
      verified: false,
      byteSize,
      storagePath: input.storagePath,
      downloadUrl: null,
      reason: "Artifact is not downloadable (signed URL missing)",
    };
  }

  const minBytes = input.artifactType === "wrapper_zip" ? 200 : 1024;
  if (byteSize < minBytes) {
    return {
      verified: false,
      byteSize,
      storagePath: input.storagePath,
      downloadUrl: input.downloadUrl,
      reason: `Artifact too small (${byteSize} bytes) for ${input.artifactType}`,
    };
  }

  return {
    verified: true,
    byteSize,
    storagePath: input.storagePath,
    downloadUrl: input.downloadUrl,
    reason: null,
  };
}

export function resolveHonestMobileBuildStatus(input: {
  artifactType: MobileArtifactType;
  artifactVerified: boolean;
  webhookConfigured: boolean;
}): {
  status: MobileBuildPipelineStatus;
  buildSuccess: boolean;
  errorMessage: string | null;
} {
  if (input.artifactType === "wrapper_zip") {
    if (!input.artifactVerified) {
      return {
        status: "failed",
        buildSuccess: false,
        errorMessage: "Wrapper ZIP upload failed verification",
      };
    }
    return { status: "success", buildSuccess: true, errorMessage: null };
  }

  if (!input.webhookConfigured) {
    return {
      status: "requires_builder_config",
      buildSuccess: false,
      errorMessage:
        "Binary build requires WRAP_ANDROID_WEBHOOK_URL or a connected Android builder. Vodex does not mark APK/AAB as succeeded without a verified binary artifact.",
    };
  }

  return {
    status: "queued",
    buildSuccess: false,
    errorMessage: null,
  };
}

export function iosPackageHonestStatus(input: {
  wrapperZipVerified: boolean;
}): {
  status: MobileBuildPipelineStatus;
  buildSuccess: boolean;
  errorMessage: string | null;
  deliverables: string[];
} {
  if (!input.wrapperZipVerified) {
    return {
      status: "failed",
      buildSuccess: false,
      errorMessage: "iOS package requires a verified Capacitor/Xcode wrapper export first",
      deliverables: [],
    };
  }
  return {
    status: "success",
    buildSuccess: true,
    errorMessage: null,
    deliverables: [
      "Capacitor iOS project (open in Xcode on macOS)",
      "App Store metadata checklist in README-MOBILE-WRAP.md",
      "Export IPA via Xcode Archive — not generated on Vodex Linux workers",
    ],
  };
}
