/**
 * Lightweight first-party analytics for published apps.
 * Injected server-side — batches events client-side, POSTs to /api/public/[slug]/analytics.
 */

export function injectPublishedAnalytics(html: string, slug: string): string {
  if (!slug?.trim() || html.includes("vodex-analytics-runtime")) return html;

  const script = `<script id="vodex-analytics-runtime">(function(){
  try{
    var SLUG=${JSON.stringify(slug.trim().toLowerCase())};
    var END="/api/public/"+SLUG+"/analytics";
    var kVid="vx_vid_"+SLUG,kSid="vx_sid_"+SLUG;
    function uid(){return"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(c){var r=Math.random()*16|0,v=c==="x"?r:(r&3|8);return v.toString(16);});}
    var vid=localStorage.getItem(kVid);if(!vid){vid=uid();localStorage.setItem(kVid,vid);}
    var sid=sessionStorage.getItem(kSid);if(!sid){sid=uid();sessionStorage.setItem(kSid,sid);sessionStorage.setItem("vx_ss","1");}
    var q=[],t=null,ss=!!sessionStorage.getItem("vx_ss");
    if(ss){sessionStorage.removeItem("vx_ss");q.push({event_type:"session_start",path:location.pathname,referrer:document.referrer||""});}
    function dev(){var m=navigator.userAgent||"";if(/mobile|android|iphone|ipad/i.test(m))return"mobile";if(/tablet/i.test(m))return"tablet";return"desktop";}
    function br(){var m=navigator.userAgent||"";if(m.indexOf("Edg/")>-1)return"Edge";if(m.indexOf("Chrome/")>-1)return"Chrome";if(m.indexOf("Firefox/")>-1)return"Firefox";if(m.indexOf("Safari/")>-1)return"Safari";return"Other";}
    function track(type,extra){q.push(Object.assign({event_type:type,path:location.pathname+location.search,referrer:document.referrer||"",device:dev(),browser:br(),visitor_id:vid,session_id:sid},extra||{}));if(!t)t=setTimeout(flush,1200);}
    function flush(){if(!q.length)return;var batch=q.splice(0,20);t=null;fetch(END,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({events:batch}),keepalive:true,credentials:"omit"}).catch(function(){});if(q.length)t=setTimeout(flush,800);}
    track("page_view",{});
    document.addEventListener("click",function(e){var a=e.target&&e.target.closest?e.target.closest("a[href]"):null;if(a&&a.href&&a.hostname&&a.hostname!==location.hostname)track("outbound_click",{target:a.href});},true);
    window.addEventListener("error",function(e){track("error_event",{message:String(e.message||"").slice(0,200)});});
    var _ps=history.pushState;history.pushState=function(){_ps.apply(history,arguments);track("route_change",{});};
    window.addEventListener("popstate",function(){track("route_change",{});});
    window.vodexTrack=function(type,extra){track(type,extra||{});};
    document.addEventListener("visibilitychange",function(){if(document.visibilityState==="hidden")flush();});
    window.addEventListener("pagehide",flush);
  }catch(e){}
})();</script>`;

  if (html.includes("</body>")) {
    return html.replace("</body>", `${script}\n</body>`);
  }
  return `${html}\n${script}`;
}
