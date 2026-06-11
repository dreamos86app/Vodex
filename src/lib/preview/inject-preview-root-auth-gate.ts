/**
 * FIRST script in preview SPA HTML — sync redirect to Vodex /login before Base44 welcome UI paints.
 */

export function buildPreviewRootAuthGateScript(): string {
  return `(function(){
  if(window.__VODEX_ROOT_AUTH_GATE__)return;
  window.__VODEX_ROOT_AUTH_GATE__=true;
  function authed(){try{return localStorage.getItem("sb-preview-auth")==="1";}catch(e){return false;}}
  function runtimeBase(){
    try{
      var m=location.pathname.match(/^(\\/preview-runtime\\/[^/]+\\/[^/]+)/);
      return m?m[1]:null;
    }catch(e){return null;}
  }
  function authTail(rest){
    return /^\\/(login|signup|sign-up|register|forgot|reset|auth)(\\/|$)/i.test(rest||"");
  }
  var base=runtimeBase();
  if(!base)return;
  var rest=location.pathname.slice(base.length).replace(/\\/+$/, "")||"";
  if(authed()){
    try{document.documentElement.style.visibility="";document.documentElement.removeAttribute("data-vodex-auth-pending");}catch(e){}
    return;
  }
  if(authTail(rest))return;
  if(!rest||rest==="/"){
    try{
      document.documentElement.setAttribute("data-vodex-auth-pending","1");
      document.documentElement.style.visibility="hidden";
    }catch(e){}
    try{
      parent.postMessage({type:"vodex-preview-boot-audit",phase:"auth-redirect",navigationMethod:"root-auth-gate",navigationUrl:base+"/login",at:new Date().toISOString()},"*");
    }catch(e){}
    location.replace(base+"/login"+(location.search||""));
  }
})();`;
}

export function injectPreviewRootAuthGate(html: string): string {
  if (html.includes('id="vodex-preview-root-auth-gate"')) return html;
  const script = `<script id="vodex-preview-root-auth-gate" data-vodex-preview-shim="true">${buildPreviewRootAuthGateScript()}</script>`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}${script}`);
  }
  return script + html;
}
