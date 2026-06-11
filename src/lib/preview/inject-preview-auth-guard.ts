/** Intercept OAuth navigation (location.href, window.open) and escape stuck Google sign-in UI. */

import { PREVIEW_AUTH_URL_RESOLVER_SNIPPET } from "@/lib/preview/preview-runtime-auth-url-script";

export function buildPreviewAuthGuardScript(): string {
  return `(function(){
  if(window.__VODEX_AUTH_GUARD__)return;
  window.__VODEX_AUTH_GUARD__=true;
  ${PREVIEW_AUTH_URL_RESOLVER_SNIPPET}
  function previewAuthed(){try{return localStorage.getItem("sb-preview-auth")==="1";}catch(e){return false;}}
  function isOAuthUrl(url){
    if(typeof url!=="string"||!url)return false;
    return /accounts\\.google|google\\.com\\/o\\/oauth|oauth2\\/auth|base44\\.(dev|app)|appleid\\.apple\\.com|\\/auth\\/google|\\/oauth\\/google/i.test(url);
  }
  function goLogin(reason){
    if(previewAuthed())return;
    __vodexGoLogin(reason||"auth guard -> preview login");
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
  try{
    var assign=location.assign.bind(location);
    location.assign=function(u){
      if(typeof u==="string"&&isOAuthUrl(u)){goLogin("blocked location.assign OAuth");return;}
      return assign(u);
    };
    var locReplace=location.replace.bind(location);
    location.replace=function(u){
      if(typeof u==="string"&&isOAuthUrl(u)){goLogin("blocked location.replace OAuth");return;}
      return locReplace(u);
    };
  }catch(e){}
  function bodyText(){
    try{return (document.body&&(document.body.innerText||document.body.textContent)||"").toLowerCase();}catch(e){return "";}
  }
  function looksStuckOnGoogle(){
    if(previewAuthed())return false;
    var t=bodyText();
    return t.indexOf("opening secure google")>=0||t.indexOf("google sign-in")>=0||t.indexOf("connecting you securely")>=0||t.indexOf("hang tight")>=0;
  }
  var stuckSince=0;
  function watchStuck(){
    if(!looksStuckOnGoogle()){stuckSince=0;return;}
    if(!stuckSince)stuckSince=Date.now();
    if(Date.now()-stuckSince>=400){
      try{parent.postMessage({type:"vodex-preview-boot-audit",phase:"auth-stuck",authStuckReason:"Google OAuth hang — redirecting to Vodex login",bodySnippet:bodyText().slice(0,400)},"*");}catch(e){}
      __vodexGoLogin("stuck on Google sign-in screen");
    }
  }
  if(typeof MutationObserver!=="undefined"&&document.documentElement){
    try{new MutationObserver(watchStuck).observe(document.documentElement,{childList:true,subtree:true,characterData:true});}catch(e){}
  }
  setInterval(watchStuck,300);
  document.addEventListener("DOMContentLoaded",watchStuck);
  setTimeout(watchStuck,500);
  setTimeout(watchStuck,1200);
  setTimeout(watchStuck,2500);
})();`;
}

export function injectPreviewAuthGuard(html: string): string {
  if (html.includes('id="vodex-preview-auth-guard"')) return html;
  const script = `<script id="vodex-preview-auth-guard" data-vodex-preview-shim="true">${buildPreviewAuthGuardScript()}</script>`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}${script}`);
  }
  return script + html;
}
