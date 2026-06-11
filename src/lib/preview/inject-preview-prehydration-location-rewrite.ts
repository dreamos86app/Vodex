/**
 * FIRST executable script in served preview HTML — patches location before Next hydration.
 * Must not contain literal preview-html poison strings (built at runtime).
 */
export function buildPrehydrationLocationRewriteScript(virtualRoute: string): string {
  let route = virtualRoute.startsWith("/") ? virtualRoute : `/${virtualRoute}`;
  if (/api\/projects\//i.test(route)) route = "/";

  return `(function(){
  var PH=('preview'+'-'+'html');
  var AP=('api/'+'projects/');
  var AAP=('/'+'api/'+'projects/');
  var RT=('/'+'preview-runtime/');
  var RTP=('preview'+'-'+'runtime');
  var params=new URLSearchParams(location.search);
  var route=${JSON.stringify(route)};
  var routeLocked=false;
  var override=params.get('route');
  if(override){if(!override.startsWith('/'))override='/'+override;route=override;routeLocked=true;}
  if(!routeLocked){
    try{
      var stored=sessionStorage.getItem('vodex-preview-post-auth-route');
      if(stored){if(!stored.startsWith('/'))stored='/'+stored;route=stored;routeLocked=true;}
    }catch(e){}
  }
  var path=location.pathname||'';
  var onProxy=path.indexOf(AAP)>=0&&path.indexOf(PH)>=0;
  var onRuntime=path.indexOf(RT)===0;
  if(!onProxy&&!onRuntime)return;
  if(onRuntime){
    var parts=path.split('/').filter(Boolean);
    if(parts.length>=3){window.__VODEX_PREVIEW_RUNTIME_BASE__='/'+parts.slice(0,3).join('/');}
    if(!routeLocked){
      if(parts.length>3){route='/'+parts.slice(3).join('/');}
      else{route='/';}
    }
  }
  window.__VODEX_PREVIEW_ORIGINAL_URL__=location.href;
  window.__VODEX_PREVIEW_VIRTUAL_ROUTE__=route;
  window.__VODEX_PREVIEW_LOCATION_REWRITTEN__=true;
  window.__VODEX_PREVIEW_ACTIVE__=true;
  window.__VODEX_VIRTUAL_PATH__=route;
  var LOCK='/';
  try{history.replaceState({__vodex:route,vodexPreview:1},'',LOCK+(location.search||''));}catch(e){}
  if('serviceWorker' in navigator){
    try{
      navigator.serviceWorker.getRegistrations().then(function(regs){regs.forEach(function(r){r.unregister();});});
      navigator.serviceWorker.register=function(){return Promise.resolve({scope:'',active:null,installing:null,waiting:null,updateViaCache:'none',unregister:function(){return Promise.resolve(true);},addEventListener:function(){},removeEventListener:function(){},dispatchEvent:function(){return true;}});};
    }catch(e){}
  }
  function normPath(p){if(!p)return'/';p=String(p).split('?')[0].split('#')[0];if(!p.startsWith('/'))p='/'+p;return p;}
  function isPlatform(p){
    if(!p||typeof p!=='string')return false;
    var s=normPath(p).toLowerCase();
    if(s.indexOf(AAP)>=0||s.indexOf(PH)>=0)return true;
    if(s.indexOf(RT)===0&&s.indexOf('/assets/')<0)return true;
    if(s.indexOf(RTP)>=0&&s.indexOf('/assets/')<0)return true;
    return false;
  }
  function poisonedText(s){
    if(!s||typeof s!=='string')return false;
    if(s.indexOf(RTP)>=0&&s.indexOf('/assets/')<0)return true;
    if(s.indexOf(PH)>=0||s.indexOf(AP)>=0)return true;
    return false;
  }
  function fixBootstrapValue(v){
    if(typeof v==='string')return isPlatform(v)?route:v;
    if(Array.isArray(v))return v.map(fixBootstrapValue);
    if(v&&typeof v==='object'){
      var o={};
      for(var k in v)o[k]=fixBootstrapValue(v[k]);
      return o;
    }
    return v;
  }
  function patchNextDataEl(){
    try{
      var el=document.getElementById('__NEXT_DATA__');
      if(!el||!el.textContent)return;
      var nd=JSON.parse(el.textContent);
      nd=fixBootstrapValue(nd);
      el.textContent=JSON.stringify(nd);
    }catch(e){}
  }
  function hookNextF(arr){
    if(!arr||typeof arr.push!=='function'||arr.__vodexHooked)return arr;
    var _push=arr.push.bind(arr);
    arr.push=function(item){
      try{
        var s=JSON.stringify(item);
        if(poisonedText(s)){
          try{item=JSON.parse(s.replace(new RegExp(RTP+'\\\\/[a-f0-9-]{36}\\\\/[a-f0-9-]{36}','gi'),'/'));}catch(e){return arr.length;}
        }
      }catch(e){}
      return _push(item);
    };
    arr.__vodexHooked=true;
    return arr;
  }
  try{
    if(!window.__next_f)window.__next_f=[];
    hookNextF(window.__next_f);
    var _nf=window.__next_f;
    Object.defineProperty(window,'__next_f',{
      configurable:true,
      get:function(){return _nf;},
      set:function(v){_nf=hookNextF(v||[]);window.__next_f=_nf;}
    });
  }catch(e){}
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
          if(isPlatform(p))p='/';
          return location.origin+p+(location.search||'');
        }
        return oh.call(this);
      },configurable:true});
    }
    var _assign=location.assign.bind(location);
    location.assign=function(url){
      if(typeof url==='string'&&isPlatform(url)){window.__VODEX_VIRTUAL_PATH__='/';try{history.replaceState({__vodex:'/'},'',LOCK+(location.search||''));}catch(e){}return;}
      _assign(url);
    };
    var _locReplace=location.replace.bind(location);
    location.replace=function(url){
      if(typeof url==='string'&&isPlatform(url)){window.__VODEX_VIRTUAL_PATH__='/';try{history.replaceState({__vodex:'/'},'',LOCK+(location.search||''));}catch(e){}return;}
      _locReplace(url);
    };
  }catch(e){}
  patchNextDataEl();
  if(typeof MutationObserver!=='undefined'&&document.documentElement){
    try{
      new MutationObserver(function(){patchNextDataEl();}).observe(document.documentElement,{childList:true,subtree:true});
    }catch(e){}
  }
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
