/** Worker copy of platform virtual-history shim (no @/ imports). */

export function buildPreviewVirtualHistoryScript(initialRoute: string): string {
  let route = initialRoute.startsWith("/") ? initialRoute : `/${initialRoute}`;
  if (/api\/projects\//i.test(route)) route = "/";

  return `(function(){
  var LOCK=location.pathname+location.search;
  var virtualPath=${JSON.stringify(route)};
  window.__VODEX_PREVIEW_ACTIVE__=true;
  window.__VODEX_VIRTUAL_PATH__=virtualPath;
  function normPath(p){if(!p)return"/";p=String(p).split("?")[0].split("#")[0];if(!p.startsWith("/"))p="/"+p;return p;}
  function isPlatformPreviewPath(p){var s=normPath(p).toLowerCase();return s.indexOf("/api/projects/")===0||s.indexOf("api/projects/")>=0;}
  function patchNextData(){try{var el=document.getElementById('__NEXT_DATA__');if(!el||!el.textContent)return;var nd=JSON.parse(el.textContent);function fixPath(p){if(!p||typeof p!=='string')return p;if(isPlatformPreviewPath(p))return'/';if(p.indexOf('preview-html')>=0)return'/';return p;}nd.page=fixPath(nd.page);nd.asPath=fixPath(nd.asPath);nd.pathname=fixPath(nd.pathname);nd.url=fixPath(nd.url);el.textContent=JSON.stringify(nd);}catch(e){}}
  patchNextData();
  function setVirtualPath(p){if(isPlatformPreviewPath(p))p="/";virtualPath=normPath(p);window.__VODEX_VIRTUAL_PATH__=virtualPath;try{history.replaceState({__vodex:virtualPath},"",LOCK);window.dispatchEvent(new PopStateEvent("popstate",{state:{__vodex:virtualPath}}));}catch(e){}}
  function internalize(url){if(typeof url!=="string")return null;if(url.startsWith("api/projects/")||url.startsWith("/api/projects/"))return"/";try{var u=new URL(url,location.href);if(u.pathname.startsWith("/api/projects/"))return"/";if(u.origin===location.origin)return normPath(u.pathname);}catch(e){}return null;}
  var _push=history.pushState.bind(history);var _replace=history.replaceState.bind(history);
  history.pushState=function(s,t,u){if(typeof u==="string"){var ip=internalize(u);if(ip){setVirtualPath(ip);return;}if(u.startsWith("/")&&!u.startsWith("//")){setVirtualPath(u);return;}}return _push(s,t,LOCK);};
  history.replaceState=function(s,t,u){if(typeof u==="string"){var ip=internalize(u);if(ip){setVirtualPath(ip);return;}if(u.startsWith("/")&&!u.startsWith("//")){setVirtualPath(u);return;}}return _replace(s,t,LOCK);};
  setVirtualPath(virtualPath);
})();`;
}

export function injectPreviewVirtualHistory(html: string, routePath = "/"): string {
  const script = `<script id="vodex-preview-virtual-history">${buildPreviewVirtualHistoryScript(routePath)}</script>`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}${script}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (m) => `${m}<head>${script}</head>`);
  }
  return script + html;
}
