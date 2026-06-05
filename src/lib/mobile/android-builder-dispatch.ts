import type { MobileArtifactType } from "@/lib/mobile/mobile-build-pipeline";

export type AndroidBuildDispatchPayload = {
  jobId: string;
  projectId: string;
  ownerId: string;
  buildType: "apk" | "aab";
  wrapperStoragePath: string;
  wrapperDownloadUrl: string;
  packageId: string;
  versionName: string;
  versionCode: number;
  callbackUrl: string;
  callbackSecret: string;
};

export async function dispatchAndroidBuildJob(
  payload: AndroidBuildDispatchPayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const webhookUrl = process.env.WRAP_ANDROID_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    return { ok: false, error: "WRAP_ANDROID_WEBHOOK_URL is not configured" };
  }

  const secret = process.env.ANDROID_BUILDER_SECRET?.trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { "X-Builder-Secret": secret } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `Builder webhook HTTP ${res.status}: ${text.slice(0, 500)}` };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Builder webhook request failed";
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

export function resolveBuildType(artifactType: MobileArtifactType): "apk" | "aab" | "wrapper_zip" {
  if (artifactType === "aab") return "aab";
  if (artifactType === "apk") return "apk";
  return "wrapper_zip";
}

export function builderCallbackUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/mobile/builder/callback`;
}
