/**
 * Verifies a published URL responds before treating publish as live.
 */
export async function verifyPublishedUrlHealth(
  publicUrl: string,
  timeoutMs = 12_000,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = publicUrl.trim();
  if (!url.startsWith("http")) {
    return { ok: false, error: "Invalid public URL" };
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
    if (res.status >= 500) {
      return { ok: false, error: `Origin returned HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Health check failed";
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}
