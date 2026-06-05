import { config } from "./config.js";

export async function postBuilderCallback(input: {
  jobId: string;
  buildType: "apk" | "aab";
  storagePath: string;
  byteSize: number;
  logs: string;
  errorMessage?: string;
}): Promise<{ ok: boolean; error?: string; buildSuccess?: boolean }> {
  const url = config.callbackUrl;
  if (!url) {
    return { ok: false, error: "ANDROID_BUILDER_CALLBACK_URL not configured" };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.builderSecret ? { "X-Builder-Secret": config.builderSecret } : {}),
    },
    body: JSON.stringify({
      jobId: input.jobId,
      builderId: config.builderId,
      buildType: input.buildType,
      storagePath: input.storagePath,
      byteSize: input.byteSize,
      logs: input.logs,
      errorMessage: input.errorMessage,
    }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    buildSuccess?: boolean;
  };
  if (!res.ok) {
    return { ok: false, error: json.error ?? `Callback HTTP ${res.status}` };
  }
  return { ok: true, buildSuccess: json.buildSuccess };
}
