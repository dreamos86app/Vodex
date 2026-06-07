/**
 * Server-side watermark for published apps.
 * - Document-flow footer: plain "Made with Vodex" at page bottom (not viewport-fixed).
 * - Optional delayed glass promo chip (dismissible per session) with real Vodex logo.
 * Free users always get both; Starter+ can disable in settings.
 */

export type WatermarkEntitlement = {
  planTier: "free" | "starter" | "pro" | "infinity";
  watermarkDisabled: boolean;
};

export function shouldInjectPublishedWatermark(ent: WatermarkEntitlement): boolean {
  if (ent.planTier === "free") return true;
  return !ent.watermarkDisabled;
}

/** In-flow page footer — cannot be position:fixed. */
const PAGE_FOOTER = `<footer id="vodex-page-watermark" data-vodex-watermark="required" aria-label="Made with Vodex" style="display:block;width:100%;margin-top:3rem;padding:1.5rem 1rem 2rem;text-align:center;font-family:system-ui,-apple-system,sans-serif;font-size:12px;line-height:1.5;color:#171717;background:transparent;border:none;clear:both;position:relative;z-index:1"><a href="https://vodex.dev?utm_source=published_app&amp;utm_medium=footer" target="_blank" rel="noopener noreferrer" style="color:#171717;text-decoration:none;font-weight:500;letter-spacing:-0.01em">Made with Vodex</a></footer>`;

export function injectPublishedWatermark(html: string, ent: WatermarkEntitlement): string {
  if (!shouldInjectPublishedWatermark(ent)) return html;
  if (html.includes("vodex-page-watermark")) return html;

  let out = html;
  if (out.includes("</body>")) {
    out = out.replace("</body>", `${PAGE_FOOTER}\n</body>`);
  } else {
    out = `${out}\n${PAGE_FOOTER}`;
  }
  return out;
}
