/** P1.3.37 — Boot/resource audit inside preview iframe; reports to parent via postMessage. */

export function buildPreviewBootAuditScript(): string {
  return `(function(){
  if(window.__VODEX_BOOT_AUDIT__)return;
  window.__VODEX_BOOT_AUDIT__=true;
  function post(phase,payload){
    try{
      parent.postMessage(Object.assign({type:"vodex-preview-boot-audit",phase:phase,iframeUrl:location.href,virtualPath:window.__VODEX_VIRTUAL_PATH__||null,at:new Date().toISOString()},payload||{}),"*");
    }catch(e){}
  }
  function snapshotResources(){
    try{
      var entries=performance.getEntriesByType("resource").map(function(e){
        return {name:e.name,initiatorType:e.initiatorType||"",transferSize:e.transferSize||0,duration:e.duration||0,responseStatus:e.responseStatus||0};
      });
      post("snapshot",{resources:entries});
    }catch(e){}
  }
  window.addEventListener("error",function(ev){
    post("runtime-error",{errorMessage:String(ev.message||ev.error||"unknown"),errorStack:ev.error&&ev.error.stack?String(ev.error.stack):undefined});
  });
  window.addEventListener("unhandledrejection",function(ev){
    post("runtime-error",{errorMessage:String(ev.reason||"unhandled rejection"),errorStack:ev.reason&&ev.reason.stack?String(ev.reason.stack):undefined});
  });
  function ignorableAssetFailure(url,tagName){
    var raw=String(url||"").trim();
    if(!raw||raw==="#"||raw.indexOf("#")===0)return true;
    var path=raw;
    try{
      if(/^https?:\\/\\//i.test(raw))path=new URL(raw).pathname;
      else path=(raw.split("?")[0]||raw).split("#")[0]||raw;
    }catch(e){path=(raw.split("?")[0]||raw);}
    if(path==="/"||path==="")return true;
    if(/\\.(js|mjs|cjs|css|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|map|json)(\\?|$)/i.test(path))return false;
    var tag=String(tagName||"").toUpperCase();
    if(/^\\/[A-Za-z0-9_./-]*$/.test(path)&&path.indexOf(".")===-1){
      if(tag==="LINK"||tag==="A"||tag==="SCRIPT")return true;
    }
    return false;
  }
  document.addEventListener("error",function(ev){
    var t=ev.target;
    if(!t||!(t instanceof HTMLElement))return;
    var url=t.getAttribute("src")||t.getAttribute("href")||"";
    if(!url||ignorableAssetFailure(url,t.tagName))return;
    post("asset-error",{failedAssetUrl:url,failedAssetTag:t.tagName});
  },true);
  if("serviceWorker" in navigator){
    try{
      navigator.serviceWorker.getRegistrations().then(function(regs){
        post("serviceworker",{serviceWorkerCount:regs.length});
      });
    }catch(e){}
  }
  function reportNav(method,url){post("navigation",{navigationMethod:method,navigationUrl:String(url||"")});}
  try{
    var _push=history.pushState.bind(history);
    history.pushState=function(s,t,u){reportNav("pushState",u);return _push(s,t,u);};
    var _replace=history.replaceState.bind(history);
    history.replaceState=function(s,t,u){reportNav("replaceState",u);return _replace(s,t,u);};
    var _assign=location.assign.bind(location);
    location.assign=function(u){reportNav("assign",u);return _assign(u);};
    var _locReplace=location.replace.bind(location);
    location.replace=function(u){reportNav("replace",u);return _locReplace(u);};
  }catch(e){}
  function signalReady(){
    post("ready",{});
    snapshotResources();
  }
  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",signalReady,{once:true});
  }else{
    signalReady();
  }
  setTimeout(snapshotResources,1500);
  setTimeout(snapshotResources,5000);
  setTimeout(snapshotResources,12000);
})();`;
}

export function injectPreviewBootAudit(html: string): string {
  if (html.includes('id="vodex-preview-boot-audit"')) return html;
  const script = `<script id="vodex-preview-boot-audit" data-vodex-preview-shim="true">${buildPreviewBootAuditScript()}</script>`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}${script}`);
  }
  return script + html;
}
