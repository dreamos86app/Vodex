/**
 * FIRST executable script in served preview HTML — patches location before Next hydration.
 * Must not contain literal preview-html poison strings (built at runtime).
 * P1.3.38 — activates for preview-runtime virtual paths, not only legacy preview-html proxy.
 */
export function buildPrehydrationLocationRewriteScript(virtualRoute: string): string {
  let route = virtualRoute.startsWith("/") ? virtualRoute : `/${virtualRoute}`;
  if (/api\/projects\//i.test(route)) route = "/";

  return `(function(){
  var PH=('preview'+'-'+'html');
  var AAP=('/'+'api/'+'projects/');
  var RT=('/'+'preview-runtime/');
  var params=new URLSearchParams(location.search);
  var route=${JSON.stringify(route)};
  var override=params.get('route');
  if(override){if(!override.startsWith('/'))override='/'+override;route=override;}
  var path=location.pathname||'';
  var onProxy=path.indexOf(AAP)>=0&&path.indexOf(PH)>=0;
  var onRuntime=path.indexOf(RT)===0;
  if(!onProxy&&!onRuntime)return;
  if(onRuntime){
    var parts=path.split('/').filter(Boolean);
    if(parts.length>3){route='/'+parts.slice(3).join('/');}
    else{route='/';}
  }
  window.__VODEX_PREVIEW_ORIGINAL_URL__=location.href;
  window.__VODEX_PREVIEW_VIRTUAL_ROUTE__=route;
  window.__VODEX_PREVIEW_LOCATION_REWRITTEN__=true;
  window.__VODEX_PREVIEW_ACTIVE__=true;
  window.__VODEX_VIRTUAL_PATH__=route;
  var LOCK=location.pathname+location.search;
  function normPath(p){if(!p)return'/';p=String(p).split('?')[0].split('#')[0];if(!p.startsWith('/'))p='/'+p;return p;}
  function isPlatform(p){
    var s=normPath(p).toLowerCase();
    if(s.indexOf(AAP)>=0||s.indexOf(PH)>=0)return true;
    if(s.indexOf(RT)===0&&s.indexOf('/assets/')<0)return true;
    var RTP=('preview'+'-'+'runtime/');
    if(s.indexOf(RTP)>=0&&s.indexOf('/assets/')<0)return true;
    return false;
  }
  try{
    var d=Object.getOwnPropertyDescriptor(Location.prototype,'pathname');
    if(d&&d.get){
      var og=d.get;
      Object.defineProperty(Location.prototype,'pathname',{get:function(){
        if(window.__VODEX_PREVIEW_ACTIVE__)return window.__VODEX_VIRTUAL_PATH__||'/';
        return og.call(this);
      },configurable:true});
    }
    var hd=Object.getOwnPropertyDescriptor(Location.prototype,'href');
    if(hd&&hd.get){
      var oh=hd.get;
      Object.defineProperty(Location.prototype,'href',{get:function(){
        if(window.__VODEX_PREVIEW_ACTIVE__){
          var p=window.__VODEX_VIRTUAL_PATH__||'/';
          return location.origin+p+(location.search||'');
        }
        return oh.call(this);
      },configurable:true});
    }
  }catch(e){}
  try{
    var el=document.getElementById('__NEXT_DATA__');
    if(el&&el.textContent){
      var nd=JSON.parse(el.textContent);
      function fix(v){return typeof v==='string'&&isPlatform(v)?route:v;}
      nd.page=fix(nd.page);nd.asPath=fix(nd.asPath);nd.pathname=fix(nd.pathname);nd.url=fix(nd.url);
      el.textContent=JSON.stringify(nd);
    }
  }catch(e){}
  try{history.replaceState({__vodex:route},'',LOCK);}catch(e){}
  try{
    window.addEventListener('message',function(e){
      if(!e.data||e.data.type!=='vodex-preview-deep-clean')return;
      try{
        if('serviceWorker' in navigator){
          navigator.serviceWorker.getRegistrations().then(function(regs){regs.forEach(function(r){r.unregister();});});
        }
        if(window.caches&&caches.keys){
          caches.keys().then(function(keys){keys.forEach(function(k){caches.delete(k);});});
        }
        try{
          for(var i=localStorage.length-1;i>=0;i--){
            var k=localStorage.key(i);
            if(k&&(k.indexOf('preview')>=0||k.indexOf('next')>=0||k.indexOf('workbox')>=0))localStorage.removeItem(k);
          }
        }catch(e){}
        try{
          for(var j=sessionStorage.length-1;j>=0;j--){
            var sk=sessionStorage.key(j);
            if(sk&&(sk.indexOf('preview')>=0||sk.indexOf('next')>=0))sessionStorage.removeItem(sk);
          }
        }catch(e){}
      }catch(e){}
      if(e.data.reload)location.reload();
    });
  }catch(e){}
})();`;
}

export function injectPreviewPrehydrationLocationRewrite(html: string, routePath = "/"): string {
  if (html.includes('id="vodex-prehydration-location-rewrite"')) return html;
  const script = `<script id="vodex-prehydration-location-rewrite" data-vodex-preview-shim="true">${buildPrehydrationLocationRewriteScript(routePath)}</script>`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}${script}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (m) => `${m}<head>${script}</head>`);
  }
  return script + html;
}
