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

const LOGO_URL = "https://vodex.dev/logo.png";

/** In-flow page footer — cannot be position:fixed. */
const PAGE_FOOTER = `<footer id="vodex-page-watermark" data-vodex-watermark="required" aria-label="Made with Vodex" style="display:block;width:100%;margin-top:3rem;padding:1.5rem 1rem 2rem;text-align:center;font-family:system-ui,-apple-system,sans-serif;font-size:12px;line-height:1.5;color:#171717;background:transparent;border:none;clear:both;position:relative;z-index:1"><a href="https://vodex.dev?utm_source=published_app&amp;utm_medium=footer" target="_blank" rel="noopener noreferrer" style="color:#171717;text-decoration:none;font-weight:500;letter-spacing:-0.01em">Made with Vodex</a></footer>`;

/**
 * Delayed glass promo — appears bottom-right after 2.5s, uses real logo, dismissible per session.
 * Not the old solid black pill.
 */
const PROMO_SCRIPT = `<script id="vodex-watermark-promo">(function(){
  try{
    var k="vodex_promo_dismissed";
    if(sessionStorage.getItem(k))return;
    var logo=${JSON.stringify(LOGO_URL)};
    setTimeout(function(){
      if(sessionStorage.getItem(k))return;
      var w=document.createElement("div");
      w.id="vodex-promo-chip";
      w.setAttribute("data-vodex-watermark","promo");
      w.innerHTML='<a href="https://vodex.dev?utm_source=published_app&amp;utm_medium=promo" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:10px;text-decoration:none;color:inherit;flex:1;min-width:0"><img src="'+logo+'" alt="Vodex" width="28" height="28" style="width:28px;height:28px;border-radius:8px;object-fit:cover;flex-shrink:0;box-shadow:0 2px 8px rgba(59,130,246,.25)"/><span style="min-width:0"><span style="display:block;font-size:11px;font-weight:650;color:#0f172a;letter-spacing:-0.02em">Built with Vodex</span><span style="display:block;font-size:10px;color:#64748b;margin-top:1px">Create your own app →</span></span></a><button type="button" aria-label="Dismiss" style="flex-shrink:0;margin-left:2px;width:22px;height:22px;border:none;background:rgba(15,23,42,.06);border-radius:6px;color:#64748b;cursor:pointer;font-size:14px;line-height:1;display:flex;align-items:center;justify-content:center">×</button>';
      w.style.cssText="position:fixed;bottom:max(20px,env(safe-area-inset-bottom));right:max(20px,env(safe-area-inset-right));z-index:2147483646;display:flex;align-items:center;gap:4px;max-width:min(280px,calc(100vw - 32px));padding:10px 12px;border-radius:16px;background:linear-gradient(135deg,rgba(255,255,255,.82),rgba(239,246,255,.78));border:1px solid rgba(99,102,241,.22);box-shadow:0 12px 40px rgba(59,130,246,.12),0 4px 16px rgba(15,23,42,.08);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);font-family:system-ui,sans-serif;opacity:0;transform:translateY(12px) scale(.96);transition:opacity .45s ease,transform .45s cubic-bezier(.22,1,.36,1)";
      w.querySelector("button").onclick=function(e){e.preventDefault();e.stopPropagation();sessionStorage.setItem(k,"1");w.style.opacity="0";w.style.transform="translateY(8px)";setTimeout(function(){w.remove()},350);};
      document.body.appendChild(w);
      requestAnimationFrame(function(){w.style.opacity="1";w.style.transform="translateY(0) scale(1)";});
    },2500);
  }catch(e){}
})();</script>`;

export function injectPublishedWatermark(html: string, ent: WatermarkEntitlement): string {
  if (!shouldInjectPublishedWatermark(ent)) return html;
  if (html.includes("vodex-page-watermark")) return html;

  let out = html;
  if (out.includes("</body>")) {
    out = out.replace("</body>", `${PAGE_FOOTER}\n${PROMO_SCRIPT}\n</body>`);
  } else {
    out = `${out}\n${PAGE_FOOTER}\n${PROMO_SCRIPT}`;
  }
  return out;
}
