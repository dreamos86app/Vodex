/**
 * Keeps the iframe URL on the preview proxy while SPAs read virtual app routes.
 * Injected script avoids literal platform preview path strings (hydration leak safe).
 */
export function buildPreviewVirtualHistoryScript(initialRoute: string): string {
  let route = initialRoute.startsWith("/") ? initialRoute : `/${initialRoute}`;
  if (/api\/projects\//i.test(route)) route = "/";

  return `(function(){
  if(!window.__VODEX_PREVIEW_ACTIVE__){
    var path=location.pathname||'';
    var PH=('preview'+'-'+'html');
    var AP=('api/'+'projects/');
    var AAP=('/'+'api/'+'projects/');
    var RT=('/'+'preview-runtime/');
    var onProxy=path.indexOf(AAP)>=0&&path.indexOf(PH)>=0;
    var onRuntime=path.indexOf(RT)===0;
    var orig=window.__VODEX_PREVIEW_ORIGINAL_URL__||'';
    if(!onProxy&&!onRuntime&&orig.indexOf(RT)<0&&orig.indexOf(PH)<0)return;
  }
  var LOCK='/';
  var virtualPath=${JSON.stringify(route)};
  var PH=('preview'+'-'+'html');
  var AP=('api/'+'projects/');
  var AAP=('/'+'api/'+'projects/');
  var RT=('/'+'preview-runtime/');
  var RTP=('preview'+'-'+'runtime');
  window.__VODEX_PREVIEW_ACTIVE__=true;
  window.__VODEX_VIRTUAL_PATH__=virtualPath;
  try{history.replaceState({__vodex:virtualPath},'',LOCK+(location.search||''));}catch(e){}
  if('serviceWorker' in navigator){
    try{
      navigator.serviceWorker.getRegistrations().then(function(regs){regs.forEach(function(r){r.unregister();});});
      navigator.serviceWorker.register=function(){return Promise.resolve({scope:'',active:null,installing:null,waiting:null,updateViaCache:'none',unregister:function(){return Promise.resolve(true);},addEventListener:function(){},removeEventListener:function(){},dispatchEvent:function(){return true;}});};
    }catch(e){}
  }
  try{
    if(window.__next_f&&Array.isArray(window.__next_f.push)){
      var _nfPush=window.__next_f.push.bind(window.__next_f);
      window.__next_f.push=function(item){
        try{
          var s=JSON.stringify(item);
          if(s.indexOf(PH)>=0||s.indexOf(AP)>=0||s.indexOf(RTP)>=0)return item.length;
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
    if(s.indexOf(AAP)===0||s.indexOf(AP)>=0||s.indexOf(PH)>=0)return true;
    if(s.indexOf(RT)===0&&s.indexOf('/assets/')<0)return true;
    if(s.indexOf(RTP)>=0&&s.indexOf('/assets/')<0)return true;
    return false;
  }
  function patchNextData(){
    try{
      var el=document.getElementById('__NEXT_DATA__');
      if(!el||!el.textContent)return;
      var nd=JSON.parse(el.textContent);
      function fixPath(p){
        if(!p||typeof p!=='string')return p;
        if(isPlatformPreviewPath(p))return'/';
        if(p.indexOf(PH)>=0)return'/';
        if(p.indexOf(RTP)>=0&&p.indexOf('/assets/')<0)return'/';
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
  function isOAuthNavUrl(url){
    if(typeof url!=="string"||!url)return false;
    return /accounts\\.google|google\\.com\\/o\\/oauth|oauth2\\/auth|base44\\.(dev|app)|appleid\\.apple\\.com|\\/auth\\/google|\\/oauth\\/google/i.test(url);
  }
  function redirectPreviewLogin(){
    if(typeof window.__vodexPreviewGoLogin==="function"){window.__vodexPreviewGoLogin("virtual-history OAuth");return;}
    try{
      var raw=window.__VODEX_PREVIEW_ORIGINAL_URL__||document.URL||location.href||"";
      var m=String(raw).match(/\\/preview-runtime\\/[^/?#]+\\/[^/?#]+/);
      if(m){location.replace(m[0]+"/login");return;}
    }catch(e){}
    setVirtualPath("/login");
  }
  function internalize(url){
    if(typeof url!=="string")return null;
    if(/base44\\.dev|base44\\.app/i.test(url))return"/login";
    if(url.indexOf(AP)===0||url.indexOf(AAP)===0)return"/";
    try{
      var u=new URL(url,location.href);
      if(u.pathname.indexOf(AAP)===0||u.pathname.indexOf(AP)>=0||u.pathname.indexOf(PH)>=0)return"/";
      var rt=('/'+'preview-runtime/');
      if(u.pathname.indexOf(rt)===0&&u.pathname.indexOf('/assets/')<0){
        var segs=u.pathname.split('/').filter(Boolean);
        if(segs.length>3)return normPath('/'+segs.slice(3).join('/'));
        return"/";
      }
      if(u.origin===location.origin)return normPath(u.pathname);
      if(/base44\\.dev|base44\\.app/i.test(u.hostname))return"/login";
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
      var origHrefSet=hrefDesc.set;
      Object.defineProperty(Location.prototype,"href",{
        get:function(){
          if(window.__VODEX_PREVIEW_ACTIVE__){
            var p=window.__VODEX_VIRTUAL_PATH__||"/";
            if(isPlatformPreviewPath(p))p="/";
            return location.origin+p+(location.search||"");
          }
          return origHrefGet.call(this);
        },
        set:function(v){
          if(typeof v==="string"&&isOAuthNavUrl(v)){redirectPreviewLogin();return;}
          if(origHrefSet)return origHrefSet.call(this,v);
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
        if(isOAuthNavUrl(url)){redirectPreviewLogin();return null;}
        var p=internalize(url);
        if(p){setVirtualPath(p);return null;}
      }
      return _open.apply(window,arguments);
    };
    var _assign=location.assign.bind(location);
    location.assign=function(url){
      if(typeof url==="string"&&isOAuthNavUrl(url)){redirectPreviewLogin();return;}
      var p=internalize(url);
      if(p){setVirtualPath(p);return;}
      if(typeof url==="string"&&isPlatformPreviewPath(url)){setVirtualPath("/");return;}
      _assign(url);
    };
    var _locReplace=location.replace.bind(location);
    location.replace=function(url){
      if(typeof url==="string"&&isOAuthNavUrl(url)){redirectPreviewLogin();return;}
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
  const script = `<script id="vodex-preview-virtual-history" data-vodex-preview-shim="true">${buildPreviewVirtualHistoryScript(routePath)}</script>`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}${script}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (m) => `${m}<head>${script}</head>`);
  }
  return script + html;
}
