import { verifyPublishedUrlHealth } from "@/lib/publish/publish-url-health";

export const PUBLISH_HEALTH_RETRY_DELAYS_MS = [5_000, 15_000, 30_000, 60_000, 120_000] as const;

export type PublishHealthAttempt = {
  attempt: number;
  delayMs: number;
  ok: boolean;
  statusCode?: number;
  finalUrl?: string;
  error?: string;
  sslOk: boolean;
  dnsOk: boolean;
};

export type PublishHealthResult =
  | {
      ok: true;
      attempts: PublishHealthAttempt[];
      totalMs: number;
      finalUrl: string;
    }
  | {
      ok: false;
      attempts: PublishHealthAttempt[];
      totalMs: number;
      error: string;
    };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function probeUrl(
  url: string,
  timeoutMs: number,
): Promise<{
  ok: boolean;
  statusCode?: number;
  finalUrl?: string;
  error?: string;
  sslOk: boolean;
  dnsOk: boolean;
}> {
  let dnsOk = true;
  let sslOk = true;
  try {
    const host = new URL(url).hostname;
    if (!host.includes(".")) dnsOk = false;
  } catch {
    dnsOk = false;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
      headers: { Accept: "text/html,application/xhtml+xml" },
    });
    const finalUrl = res.url || url;
    if (url.startsWith("https") && finalUrl.startsWith("http://")) sslOk = false;
    if (res.status >= 500) {
      return {
        ok: false,
        statusCode: res.status,
        finalUrl,
        error: `HTTP ${res.status}`,
        sslOk,
        dnsOk,
      };
    }
    return { ok: true, statusCode: res.status, finalUrl, sslOk, dnsOk };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Request failed";
    if (/certificate|ssl|tls/i.test(msg)) sslOk = false;
    if (/getaddrinfo|dns|enotfound/i.test(msg)) dnsOk = false;
    return { ok: false, error: msg, sslOk, dnsOk };
  } finally {
    clearTimeout(timer);
  }
}

/** Production publish health — retries at 5s, 15s, 30s, 60s, 120s (DNS/SSL propagation). */
export async function verifyPublishedUrlHealthWithRetry(
  publicUrl: string,
  options?: { delaysMs?: readonly number[]; perAttemptTimeoutMs?: number },
): Promise<PublishHealthResult> {
  const delays = options?.delaysMs ?? PUBLISH_HEALTH_RETRY_DELAYS_MS;
  const timeoutMs = options?.perAttemptTimeoutMs ?? 15_000;
  const started = Date.now();
  const attempts: PublishHealthAttempt[] = [];

  for (let i = 0; i < delays.length; i++) {
    if (i > 0) await sleep(delays[i]);
    const probe = await probeUrl(publicUrl, timeoutMs);
    attempts.push({
      attempt: i + 1,
      delayMs: delays[i],
      ok: probe.ok,
      statusCode: probe.statusCode,
      finalUrl: probe.finalUrl,
      error: probe.error,
      sslOk: probe.sslOk,
      dnsOk: probe.dnsOk,
    });
    if (probe.ok) {
      return {
        ok: true,
        attempts,
        totalMs: Date.now() - started,
        finalUrl: probe.finalUrl ?? publicUrl,
      };
    }
  }

  const fallback = await verifyPublishedUrlHealth(publicUrl, timeoutMs);
  if (fallback.ok) {
    return {
      ok: true,
      attempts,
      totalMs: Date.now() - started,
      finalUrl: publicUrl,
    };
  }

  return {
    ok: false,
    attempts,
    totalMs: Date.now() - started,
    error: attempts[attempts.length - 1]?.error ?? fallback.error,
  };
}
