/**
 * Detects when an imported Next.js app renders its own 404 for the preview proxy path.
 * Injected script avoids literal platform preview path strings (hydration leak safe).
 */
export function buildPreviewInnerWatchdogScript(): string {
  return `(function(){
  var SENT=false;
  var PH=('preview'+'-'+'html');
  var AP=('api/'+'projects/');
  var RTP=('preview'+'-'+'runtime');
  function removeInjectedNodes(root){
    var sel='script,style,noscript,template,svg script,[data-vodex-preview-watchdog],[data-vodex-preview-shim]';
    root.querySelectorAll(sel).forEach(function(n){n.remove();});
  }
  function visibleText(){
    var t=document.title||"";
    var b="";
    try{
      if(!document.body)return t;
      var clone=document.body.cloneNode(true);
      removeInjectedNodes(clone);
      b=clone.innerText||clone.textContent||"";
    }catch(e){}
    return (t+" "+b).replace(/\\s+/g," ").trim();
  }
  function extractBadPath(text){
    var re=new RegExp('api\\\\/projects\\\\/[a-f0-9-]{36}\\\\/'+PH,'i');
    var m=text.match(re);
    if(m)return m[0];
    m=text.match(new RegExp('"([^"]*api\\\\/projects\\\\/[^"]*'+PH+'[^"]*)"','i'));
    if(m)return m[1];
    m=text.match(new RegExp(RTP+'\\\\/[a-f0-9-]{36}\\\\/[a-f0-9-]{36}','i'));
    if(m)return m[0];
    m=text.match(new RegExp('"([^"]*'+RTP+'\\\\/[a-f0-9-]{36}\\\\/[a-f0-9-]{36}[^"]*)"','i'));
    if(m)return m[1];
    return null;
  }
  function looksLikeInnerNext404(text){
    var lower=text.toLowerCase();
    var has404=lower.indexOf("page not found")>=0||lower.indexOf("could not be found in this application")>=0;
    if(!has404)return false;
    var bad=extractBadPath(text);
    if(bad)return true;
    if(lower.indexOf(PH)>=0&&has404)return true;
    if(lower.indexOf(RTP)>=0&&has404)return true;
    return false;
  }
  function report(){
    if(SENT||window.__VODEX_INNER_ERROR_SENT__)return;
    var text=visibleText();
    if(!looksLikeInnerNext404(text))return;
    SENT=true;
    window.__VODEX_INNER_ERROR_SENT__=true;
    var bad=extractBadPath(text)||(RTP+'/.../...');
    try{
      parent.postMessage({
        type:"vodex-preview-inner-error",
        kind:"inner_next_route_404",
        path:bad,
        details:{
          title:document.title||"",
          bodySnippet:text.slice(0,500),
          detectedAt:new Date().toISOString()
        }
      },"*");
    }catch(e){}
  }
  function schedule(){
    report();
    setTimeout(report,120);
    setTimeout(report,400);
    setTimeout(report,900);
    setTimeout(report,1800);
  }
  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",schedule);
  }else{schedule();}
  var n=0;
  var iv=setInterval(function(){
    report();
    if(SENT||++n>48)clearInterval(iv);
  },300);
})();`;
}

export function injectPreviewInnerWatchdog(html: string): string {
  if (html.includes('data-vodex-preview-watchdog="true"')) return html;
  const script = `<script id="vodex-preview-inner-watchdog" data-vodex-preview-watchdog="true">${buildPreviewInnerWatchdogScript()}</script>`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}${script}`);
  }
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body[^>]*>/i, (m) => `${m}${script}`);
  }
  return script + html;
}
