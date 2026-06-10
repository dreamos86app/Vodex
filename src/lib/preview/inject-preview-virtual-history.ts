/**
 * Keeps the iframe URL on preview-html while SPAs read virtual app routes.
 * Prevents replaceState("/dashboard") from escaping to platform origin paths.
 * Blocks navigation to api/projects/* (relative or absolute) inside artifact SPAs.
 */
export function buildPreviewVirtualHistoryScript(initialRoute: string): string {
  let route = initialRoute.startsWith("/") ? initialRoute : `/${initialRoute}`;
  if (/api\/projects\//i.test(route)) route = "/";

  return `(function(){
  var LOCK=location.pathname+location.search;
  var virtualPath=${JSON.stringify(route)};
  window.__VODEX_PREVIEW_ACTIVE__=true;
  window.__VODEX_VIRTUAL_PATH__=virtualPath;
  if('serviceWorker' in navigator){
    try{
      navigator.serviceWorker.getRegistrations().then(function(regs){regs.forEach(function(r){r.unregister();});});
      var _swReg=navigator.serviceWorker.register;
      navigator.serviceWorker.register=function(){return Promise.resolve({scope:'',active:null,installing:null,waiting:null,updateViaCache:'none',unregister:function(){return Promise.resolve(true);},addEventListener:function(){},removeEventListener:function(){},dispatchEvent:function(){return true;}});};
    }catch(e){}
  }
  try{
    if(window.__next_f&&Array.isArray(window.__next_f.push)){
      var _nfPush=window.__next_f.push.bind(window.__next_f);
      window.__next_f.push=function(item){
        try{
          var s=JSON.stringify(item);
          if(s.indexOf('preview-html')>=0||s.indexOf('api/projects/')>=0)return item.length;
        }catch(e){}
        return _nfPush(item);
      };
    }
  }catch(e){}

  function normPath(p){
    if(!p)return"/";
    p=String(p).split("?")[0].split("#")[0];
    if(!p.startsWith("/"))p="/"+p;
    return p;
  }
  function isPlatformPreviewPath(p){
    var s=normPath(p).toLowerCase();
    return s.indexOf("/api/projects/")===0||s.indexOf("api/projects/")>=0;
  }
  function patchNextData(){
    try{
      var el=document.getElementById('__NEXT_DATA__');
      if(!el||!el.textContent)return;
      var nd=JSON.parse(el.textContent);
      function fixPath(p){
        if(!p||typeof p!=='string')return p;
        if(isPlatformPreviewPath(p))return'/';
        if(p.indexOf('preview-html')>=0)return'/';
        return p;
      }
      nd.page=fixPath(nd.page);
      nd.asPath=fixPath(nd.asPath);
      nd.pathname=fixPath(nd.pathname);
      nd.url=fixPath(nd.url);
      el.textContent=JSON.stringify(nd);
    }catch(e){}
  }
  patchNextData();
  if(typeof MutationObserver!=='undefined'&&document.documentElement){
    try{
      new MutationObserver(function(){patchNextData();}).observe(document.documentElement,{childList:true,subtree:true});
    }catch(e){}
  }
  function isExternalPlatformHost(hostname){
    if(!hostname)return false;
    return /vodex\\.dev$/i.test(hostname)||/\\.vodex\\.app$/i.test(hostname);
  }
  function setVirtualPath(p){
    if(isPlatformPreviewPath(p))p="/";
    virtualPath=normPath(p);
    window.__VODEX_VIRTUAL_PATH__=virtualPath;
    try{
      history.replaceState({__vodex:virtualPath},"",LOCK);
      window.dispatchEvent(new PopStateEvent("popstate",{state:{__vodex:virtualPath}}));
    }catch(e){}
  }
  function internalize(url){
    if(typeof url!=="string")return null;
    if(/^api\\/projects\\//i.test(url)||url.startsWith("api/projects/")||url.startsWith("/api/projects/"))return"/";
    try{
      var u=new URL(url,location.href);
      if(u.pathname.startsWith("/api/projects/")||u.pathname.indexOf("api/projects/")>=0)return"/";
      if(u.origin===location.origin)return normPath(u.pathname);
      if(isExternalPlatformHost(u.hostname))return normPath(u.pathname)||"/";
    }catch(e){}
    return null;
  }
  try{
    var pathDesc=Object.getOwnPropertyDescriptor(Location.prototype,"pathname");
    if(pathDesc&&pathDesc.get){
      var origPathGet=pathDesc.get;
      Object.defineProperty(Location.prototype,"pathname",{
        get:function(){
          if(window.__VODEX_PREVIEW_ACTIVE__){
            var vp=window.__VODEX_VIRTUAL_PATH__||"/";
            return isPlatformPreviewPath(vp)?"/":vp;
          }
          return origPathGet.call(this);
        },
        configurable:true
      });
    }
    var hrefDesc=Object.getOwnPropertyDescriptor(Location.prototype,"href");
    if(hrefDesc&&hrefDesc.get){
      var origHrefGet=hrefDesc.get;
      Object.defineProperty(Location.prototype,"href",{
        get:function(){
          if(window.__VODEX_PREVIEW_ACTIVE__){
            var p=window.__VODEX_VIRTUAL_PATH__||"/";
            if(isPlatformPreviewPath(p))p="/";
            return location.origin+p+(location.search||"");
          }
          return origHrefGet.call(this);
        },
        configurable:true
      });
    }
  }catch(e){}
  var _push=history.pushState.bind(history);
  var _replace=history.replaceState.bind(history);
  history.pushState=function(s,t,u){
    if(typeof u==="string"){
      var ip=internalize(u);
      if(ip){setVirtualPath(ip);return;}
      if(u.startsWith("/")&&!u.startsWith("//")){setVirtualPath(u);return;}
      if(isPlatformPreviewPath(u)){setVirtualPath("/");return;}
    }
    return _push(s,t,LOCK);
  };
  history.replaceState=function(s,t,u){
    if(typeof u==="string"){
      var ip=internalize(u);
      if(ip){setVirtualPath(ip);return;}
      if(u.startsWith("/")&&!u.startsWith("//")){setVirtualPath(u);return;}
      if(isPlatformPreviewPath(u)){setVirtualPath("/");return;}
    }
    return _replace(s,t,LOCK);
  };
  document.addEventListener("click",function(e){
    var a=e.target&&e.target.closest?e.target.closest("a[href]"):null;
    if(!a)return;
    var href=a.getAttribute("href")||a.href||"";
    if(isPlatformPreviewPath(href)){e.preventDefault();e.stopPropagation();setVirtualPath("/");return;}
    var p=internalize(href);
    if(p){e.preventDefault();e.stopPropagation();setVirtualPath(p);}
  },true);
  try{
    var _open=window.open;
    window.open=function(url,target,features){
      if(typeof url==="string"){
        var p=internalize(url);
        if(p){setVirtualPath(p);return null;}
      }
      return _open.apply(window,arguments);
    };
    var _assign=location.assign.bind(location);
    location.assign=function(url){
      var p=internalize(url);
      if(p){setVirtualPath(p);return;}
      if(typeof url==="string"&&isPlatformPreviewPath(url)){setVirtualPath("/");return;}
      _assign(url);
    };
    var _locReplace=location.replace.bind(location);
    location.replace=function(url){
      var p=internalize(url);
      if(p){setVirtualPath(p);return;}
      if(typeof url==="string"&&isPlatformPreviewPath(url)){setVirtualPath("/");return;}
      _locReplace(url);
    };
  }catch(e){}
  window.addEventListener("message",function(e){
    if(!e.data||e.data.type!=="vodex:navigate")return;
    setVirtualPath(e.data.path||"/");
  });
  setVirtualPath(virtualPath);
})();`;
}

export function injectPreviewVirtualHistory(html: string, routePath: string): string {
  const script = `<script id="vodex-preview-virtual-history">${buildPreviewVirtualHistoryScript(routePath)}</script>`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}${script}`);
  }
  // Shim must be first executable in head — strip duplicate injections
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (m) => `${m}<head>${script}</head>`);
  }
  return script + html;
}
