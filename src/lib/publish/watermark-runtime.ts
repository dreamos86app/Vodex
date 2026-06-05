/**
 * Server-side watermark injection for published apps.
 * Free users always get footer + floating badge; Starter+ can disable via settings.
 */

export type WatermarkEntitlement = {
  planTier: "free" | "starter" | "pro" | "infinity";
  watermarkDisabled: boolean;
};

export function shouldInjectPublishedWatermark(ent: WatermarkEntitlement): boolean {
  if (ent.planTier === "free") return true;
  return !ent.watermarkDisabled;
}

const WATERMARK_SCRIPT = `<script id="vodex-watermark-runtime">(function(){
  try{
    var k="vodex_wm_closed";
    if(sessionStorage.getItem(k))return;
    var b=document.createElement("div");
    b.id="vodex-built-badge";
    b.innerHTML='<a href="https://vodex.dev" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:8px;text-decoration:none;color:inherit"><span style="width:22px;height:22px;border-radius:6px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff">V</span><span><span style="display:block;font-size:11px;font-weight:700;color:#f8fafc">Built with Vodex</span><span style="display:block;font-size:10px;color:#94a3b8">Create your app</span></span></a><button type="button" aria-label="Close" style="margin-left:4px;background:none;border:none;color:#94a3b8;cursor:pointer;font-size:16px;line-height:1;padding:2px 4px">×</button>';
    b.style.cssText="position:fixed;bottom:max(16px,env(safe-area-inset-bottom));right:max(16px,env(safe-area-inset-right));z-index:2147483646;display:flex;align-items:center;gap:4px;padding:10px 12px;border-radius:14px;background:rgba(15,23,42,.92);border:1px solid rgba(129,140,248,.35);box-shadow:0 8px 32px rgba(0,0,0,.35);backdrop-filter:blur(12px);font-family:system-ui,sans-serif";
    b.querySelector("button").onclick=function(e){e.preventDefault();e.stopPropagation();sessionStorage.setItem(k,"1");b.remove();};
    document.body.appendChild(b);
  }catch(e){}
})();</script>`;

const FOOTER_HTML = `<footer id="vodex-watermark-footer" style="position:fixed;bottom:0;left:0;right:0;z-index:2147483645;padding:6px 12px;padding-bottom:max(6px,env(safe-area-inset-bottom));text-align:center;font-size:10px;font-family:system-ui,sans-serif;background:rgba(255,255,255,.92);border-top:1px solid #e2e8f0;color:#64748b"><a href="https://vodex.dev" target="_blank" rel="noopener" style="color:#6366f1;font-weight:600;text-decoration:none">Made with Vodex</a></footer>`;

export function injectPublishedWatermark(html: string, ent: WatermarkEntitlement): string {
  if (!shouldInjectPublishedWatermark(ent)) return html;
  if (html.includes("vodex-watermark-runtime")) return html;

  let out = html;
  if (out.includes("</body>")) {
    out = out.replace("</body>", `${FOOTER_HTML}\n${WATERMARK_SCRIPT}\n</body>`);
  } else {
    out = `${out}\n${FOOTER_HTML}\n${WATERMARK_SCRIPT}`;
  }
  return out;
}
