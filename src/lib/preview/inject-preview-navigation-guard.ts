/**
 * Prevents imported SPAs from navigating the iframe to raw vodex.dev app URLs
 * (which X-Frame-Options blocks → "refused to connect").
 */
export function injectPreviewNavigationGuard(html: string): string {
  const script = `<script id="vodex-preview-nav-guard">(function(){
  function internalize(url){
    try{
      var u=new URL(url,window.location.href);
      if(u.origin===window.location.origin)return null;
      if(/vodex\\.dev$/i.test(u.hostname)||/\\.vodex\\.app$/i.test(u.hostname)){
        return u.pathname+(u.search||"")+(u.hash||"");
      }
    }catch(e){}
    return null;
  }
  function go(path){
    if(!path||path[0]!=="/")path="/"+(path||"");
    try{
      if(window.history&&window.history.replaceState){
        window.history.replaceState(null,"",path);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    }catch(e){}
  }
  document.addEventListener("click",function(e){
    var a=e.target&&e.target.closest?e.target.closest("a[href]"):null;
    if(!a)return;
    var p=internalize(a.href);
    if(p){e.preventDefault();e.stopPropagation();go(p);}
  },true);
  var _push=history.pushState.bind(history);
  var _replace=history.replaceState.bind(history);
  history.pushState=function(s,t,u){var p=typeof u==="string"?internalize(u):null;if(p){go(p);return;}return _push(s,t,u);};
  history.replaceState=function(s,t,u){var p=typeof u==="string"?internalize(u):null;if(p){go(p);return;}return _replace(s,t,u);};
})();</script>`;

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}${script}`);
  }
  return script + html;
}
