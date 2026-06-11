/** Intercept OAuth navigation (location.href, window.open) and escape stuck Google sign-in UI. */

export function buildPreviewAuthGuardScript(): string {
  return `(function(){
  if(window.__VODEX_AUTH_GUARD__)return;
  window.__VODEX_AUTH_GUARD__=true;
  var warn=function(m){try{console.warn("[Vodex preview]",m);}catch(e){}};
  function previewAuthed(){try{return localStorage.getItem("sb-preview-auth")==="1";}catch(e){return false;}}
  function previewLoginUrl(){
    try{
      var m=window.location.pathname.match(/^(\\/preview-runtime\\/[^/]+\\/[^/]+)/);
      if(m)return m[1]+"/login";
    }catch(e){}
    return null;
  }
  function isOAuthUrl(url){
    if(typeof url!=="string"||!url)return false;
    return /accounts\\.google|google\\.com\\/o\\/oauth|oauth2\\/auth|base44\\.(dev|app)|appleid\\.apple\\.com|\\/auth\\/google|\\/oauth\\/google/i.test(url);
  }
  function goLogin(reason){
    if(previewAuthed())return;
    warn(reason||"auth guard -> preview login");
    var u=previewLoginUrl();
    if(u){window.location.href=u;return;}
    try{
      window.__VODEX_VIRTUAL_PATH__="/login";
      history.replaceState({__vodex:"/login"},"","/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    }catch(e){}
  }
  try{
    var _open=window.open;
    window.open=function(url,target,features){
      if(typeof url==="string"&&isOAuthUrl(url)){goLogin("blocked OAuth popup");return null;}
      return _open.apply(window,arguments);
    };
  }catch(e){}
  try{
    var hrefDesc=Object.getOwnPropertyDescriptor(Location.prototype,"href");
    if(hrefDesc&&hrefDesc.set){
      var origSet=hrefDesc.set;
      Object.defineProperty(Location.prototype,"href",{
        get:hrefDesc.get?hrefDesc.get:function(){return origSet.call(this);},
        set:function(v){
          if(isOAuthUrl(String(v))){goLogin("blocked location.href OAuth");return;}
          return origSet.call(this,v);
        },
        configurable:true
      });
    }
  }catch(e){}
  function bodyText(){
    try{return (document.body&&(document.body.innerText||document.body.textContent)||"").toLowerCase();}catch(e){return "";}
  }
  function looksStuckOnGoogle(){
    if(previewAuthed())return false;
    var t=bodyText();
    return t.indexOf("opening secure google")>=0||t.indexOf("google sign-in")>=0||t.indexOf("connecting you securely")>=0;
  }
  var stuckSince=0;
  function watchStuck(){
    if(!looksStuckOnGoogle()){stuckSince=0;return;}
    if(!stuckSince)stuckSince=Date.now();
    if(Date.now()-stuckSince>=800){
      try{parent.postMessage({type:"vodex-preview-boot-audit",phase:"auth-stuck",authStuckReason:"Google OAuth hang — redirecting to Vodex login",bodySnippet:bodyText().slice(0,400)},"*");}catch(e){}
      goLogin("stuck on Google sign-in screen");
    }
  }
  if(typeof MutationObserver!=="undefined"&&document.documentElement){
    try{new MutationObserver(watchStuck).observe(document.documentElement,{childList:true,subtree:true,characterData:true});}catch(e){}
  }
  setInterval(watchStuck,400);
  document.addEventListener("DOMContentLoaded",watchStuck);
  setTimeout(watchStuck,800);
  setTimeout(watchStuck,1600);
  setTimeout(watchStuck,3000);
})();`;
}

export function injectPreviewAuthGuard(html: string): string {
  if (html.includes("vodex-preview-auth-guard")) return html;
  const script = `<script id="vodex-preview-auth-guard" data-vodex-preview-shim="true">${buildPreviewAuthGuardScript()}</script>`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}${script}`);
  }
  return script + html;
}
