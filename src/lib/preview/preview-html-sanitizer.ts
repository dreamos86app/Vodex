/**
 * Strip unsafe / malformed scripts from preview HTML before iframe srcDoc.
 */

const MALFORMED_TRY_RE = /\btry\s*\{[\s\S]{0,2000}?(?!\bcatch\b|\bfinally\b)/;

/** Remove inline scripts from generated body (keep platform-injected head scripts separate). */
export function stripInlineScriptsFromPreviewBody(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<script\b[^>]*\/?>/gi, "");
}

/** Detect JS that would throw "Missing catch or finally after try" in browsers. */
export function hasMalformedTryBlock(js: string): boolean {
  if (!/\btry\s*\{/.test(js)) return false;
  const re = /\btry\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(js))) {
    const slice = js.slice(m.index, m.index + 2500);
    if (!/\bcatch\b/.test(slice) && !/\bfinally\b/.test(slice)) {
      return true;
    }
  }
  return false;
}

export function validatePreviewHtmlSafe(html: string): { ok: true } | { ok: false; reason: string } {
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of scripts) {
    const body = match[1] ?? "";
    if (hasMalformedTryBlock(body)) {
      return { ok: false, reason: "malformed_try_in_preview_script" };
    }
  }
  if (MALFORMED_TRY_RE.test(html) && scripts.length === 0) {
    return { ok: false, reason: "malformed_try_in_preview_html" };
  }
  return { ok: true };
}

export function sanitizePreviewDocument(html: string): string {
  const validated = validatePreviewHtmlSafe(html);
  if (!validated.ok) {
    return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  }
  return html;
}
