/**
 * Listens for postMessage route navigation inside preview iframe — avoids full iframe reload.
 */
export function injectPreviewRouteListener(html: string): string {
  const script = `<script id="vodex-preview-route-listener">(function(){
  window.addEventListener("message",function(e){
    if(!e.data||e.data.type!=="vodex:navigate")return;
    var p=e.data.path||"/";
    if(!p.startsWith("/"))p="/"+p;
    try{if(window.history&&window.history.replaceState){window.history.replaceState(null,"",p);window.dispatchEvent(new PopStateEvent("popstate"));}}catch(err){}
  });
})();</script>`;

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}${script}`);
  }
  return script + html;
}
