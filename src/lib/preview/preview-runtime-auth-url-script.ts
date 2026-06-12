/**
 * Shared preview-runtime auth URL helpers injected into iframe HTML/JS.
 * MUST NOT rely on location.pathname — virtual history patches it to app routes.
 */

export function buildPreviewRuntimeAuthUrlBootstrapScript(
  projectId?: string,
  artifactId?: string,
): string {
  const base =
    projectId && artifactId ? `/preview-runtime/${projectId}/${artifactId}` : null;

  return `(function(){
  if(window.__VODEX_AUTH_URL_BOOT__)return;
  window.__VODEX_AUTH_URL_BOOT__=true;
  function captureRuntimeBase(){
    if(window.__VODEX_PREVIEW_RUNTIME_BASE__)return window.__VODEX_PREVIEW_RUNTIME_BASE__;
    ${base ? `window.__VODEX_PREVIEW_RUNTIME_BASE__=${JSON.stringify(base)};` : ""}
    if(window.__VODEX_PREVIEW_RUNTIME_BASE__)return window.__VODEX_PREVIEW_RUNTIME_BASE__;
    try{
      var raw=window.__VODEX_PREVIEW_ORIGINAL_URL__||document.URL||location.href||"";
      var m=String(raw).match(/\\/preview-runtime\\/[^/?#]+\\/[^/?#]+/);
      if(m){window.__VODEX_PREVIEW_RUNTIME_BASE__=m[0];return m[0];}
    }catch(e){}
    try{
      var path=location.pathname||"";
      if(path.indexOf("/preview-runtime/")===0){
        var parts=path.split("/").filter(Boolean);
        if(parts.length>=3){
          var b="/"+parts.slice(0,3).join("/");
          window.__VODEX_PREVIEW_RUNTIME_BASE__=b;
          return b;
        }
      }
    }catch(e){}
    return null;
  }
  window.__vodexPreviewRuntimeBase=function(){return captureRuntimeBase();};
  window.__vodexPreviewLoginUrl=function(suffix){
    suffix=suffix||"/login";
    if(!suffix.startsWith("/"))suffix="/"+suffix;
    var base=captureRuntimeBase();
    return base?base+suffix:null;
  };
  window.__vodexPreviewAppUrl=function(route){
    route=route||window.__VODEX_PREVIEW_APP_HOME__||"/home";
    if(!route.startsWith("/"))route="/"+route;
    var base=null;
    if(typeof window.__vodexPreviewLoginUrl==="function")base=window.__vodexPreviewLoginUrl("/");
    if(!base&&window.__VODEX_PREVIEW_RUNTIME_BASE__)base=window.__VODEX_PREVIEW_RUNTIME_BASE__;
    if(!base)return null;
    var sep=base.indexOf("?")>=0?"&":"?";
    return base+sep+"route="+encodeURIComponent(route);
  };
  window.__vodexPreviewGoAppHome=function(reason){
    try{
      var route=sessionStorage.getItem("vodex-preview-post-auth-route")||window.__VODEX_PREVIEW_APP_HOME__||"/home";
      var url=window.__vodexPreviewAppUrl(route);
      if(!url)return false;
      try{console.warn("[Vodex preview]",reason||"redirect -> app home");}catch(e){}
      window.location.replace(url);
      return true;
    }catch(e){return false;}
  };
  window.__vodexPreviewGoLogin=function(reason){
    try{if(localStorage.getItem("sb-preview-auth")==="1")return window.__vodexPreviewGoAppHome(reason);}catch(e){}
    var url=window.__vodexPreviewLoginUrl("/login");
    if(!url)return false;
    try{console.warn("[Vodex preview]",reason||"redirect -> Vodex login");}catch(e){}
    try{
      parent.postMessage({type:"vodex-preview-boot-audit",phase:"auth-redirect",navigationMethod:"go-login",navigationUrl:url,at:new Date().toISOString()},"*");
    }catch(e){}
    window.location.replace(url);
    return true;
  };
  window.__vodexPreviewGoSignup=function(reason){
    try{if(localStorage.getItem("sb-preview-auth")==="1")return window.__vodexPreviewGoAppHome(reason);}catch(e){}
    var url=window.__vodexPreviewLoginUrl("/signup");
    if(!url)return window.__vodexPreviewGoLogin(reason);
    try{console.warn("[Vodex preview]",reason||"redirect -> Vodex signup");}catch(e){}
    window.location.replace(url);
    return true;
  };
})();`;
}

/** Inline resolver used inside other shim scripts (after bootstrap). */
export const PREVIEW_AUTH_URL_RESOLVER_SNIPPET = `
function __vodexResolveLoginUrl(){
  if(typeof window.__vodexPreviewLoginUrl==="function"){
    var u=window.__vodexPreviewLoginUrl("/login");
    if(u)return u;
  }
  try{
    var raw=window.__VODEX_PREVIEW_ORIGINAL_URL__||document.URL||location.href||"";
    var m=String(raw).match(/\\/preview-runtime\\/[^/?#]+\\/[^/?#]+/);
    if(m)return m[0]+"/login";
  }catch(e){}
  if(window.__VODEX_PREVIEW_RUNTIME_BASE__)return window.__VODEX_PREVIEW_RUNTIME_BASE__+"/login";
  return null;
}
function __vodexGoLogin(reason){
  if(typeof window.__vodexPreviewGoLogin==="function"&&window.__vodexPreviewGoLogin(reason))return true;
  try{if(localStorage.getItem("sb-preview-auth")==="1"&&typeof window.__vodexPreviewGoAppHome==="function"&&window.__vodexPreviewGoAppHome(reason))return true;}catch(e){}
  var u=__vodexResolveLoginUrl();
  if(!u)return false;
  try{console.warn("[Vodex preview]",reason||"redirect login");}catch(e){}
  window.location.replace(u);
  return true;
}`;

export const PREVIEW_AUTH_NAV_FN =
  "async function(){if(typeof window.__vodexPreviewGoLogin==='function'){window.__vodexPreviewGoLogin('chunk redirectToLogin');return Promise.resolve({ok:true});}var u=(function(){try{var r=window.__VODEX_PREVIEW_RUNTIME_BASE__;if(r)return r+'/login';var m=String(document.URL||location.href).match(/\\/preview-runtime\\/[^/?#]+\\/[^/?#]+/);return m?m[0]+'/login':null;}catch(e){return null;}})();if(u){window.location.replace(u);return Promise.resolve({ok:true});}return Promise.resolve({ok:false});}";
