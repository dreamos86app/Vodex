import type { ZipImportFile } from "@/lib/import/zip-file-validator";
import type { FrameworkDetection } from "@/lib/imports/framework-detector";
import { rewriteForeignSupabaseStorageUrls } from "@/lib/preview/preview-external-asset-rewrite";
import {
  PREVIEW_AUTH_NAV_FN,
  PREVIEW_AUTH_URL_RESOLVER_SNIPPET,
} from "@/lib/preview/preview-runtime-auth-url-script";

export type LegacyAdapterInfo = {
  platform: "base44" | "lovable" | "bolt" | "v0" | null;
  warnings: string[];
  missingEnvs: string[];
  shimScript: string;
};

const ENV_RE = /^(VITE_|NEXT_PUBLIC_|BASE44_|SUPABASE_)[A-Z0-9_]+/;

export function analyzeLegacyAdapter(
  files: ZipImportFile[],
  framework: FrameworkDetection,
): LegacyAdapterInfo {
  const warnings: string[] = [];
  const missingEnvs = new Set<string>();
  const combined = files.map((f) => f.content).join("\n");

  for (const f of files) {
    if (!/\.(tsx?|jsx?|env|example)$/i.test(f.path)) continue;
    for (const line of f.content.split("\n")) {
      const m = line.match(/^([A-Z][A-Z0-9_]*)=/);
      if (m && ENV_RE.test(m[1]!)) missingEnvs.add(m[1]!);
    }
    const refs = f.content.match(/import\.meta\.env\.([A-Z0-9_]+)/g) ?? [];
    for (const ref of refs) {
      const key = ref.replace("import.meta.env.", "");
      if (key) missingEnvs.add(key);
    }
  }

  let platform: LegacyAdapterInfo["platform"] = null;
  if (framework.id === "base44" || /base44/i.test(framework.label)) platform = "base44";
  else if (framework.id === "lovable" || /lovable/i.test(framework.label)) platform = "lovable";
  else if (framework.id === "bolt") platform = "bolt";
  else if (framework.id === "v0") platform = "v0";

  if (platform === "base44") {
    warnings.push(
      "Legacy Base44 SDK detected. Preview uses safe mocks — connect Vodex integrations for production.",
    );
  } else if (platform === "lovable") {
    warnings.push(
      "Lovable-style export detected. Missing Supabase env vars are stubbed in preview only.",
    );
  }

  const shimScript = `<script data-vodex-preview-shim="1">
(function(){
  var warn=function(m){try{console.warn("[Vodex preview]",m);}catch(e){}};
  var mockUser={id:"preview-user",email:"preview@vodex.dev",user_metadata:{full_name:"Preview User"}};
  var emptyList=Promise.resolve({data:[],error:null});
  var ok=Promise.resolve({data:{},error:null});
  if(typeof window!=="undefined"){
    window.__VODEX_PREVIEW__=true;
    window.__BASE44_PREVIEW_MOCK__=true;
    ${PREVIEW_AUTH_URL_RESOLVER_SNIPPET}
    function vodexNavigateLogin(){
      __vodexGoLogin("base44 shim -> Vodex preview login");
      return Promise.resolve({ok:true});
    }
    function vodexPreviewAuthed(){
      try{return localStorage.getItem("sb-preview-auth")==="1";}catch(e){return false;}
    }
    function vodexQueryChain(){
        var q={};
        q.select=function(){return q;};
        q.insert=function(){return q;};
        q.update=function(){return q;};
        q.delete=function(){return q;};
        q.eq=function(){return q;};
        q.is=function(){return q;};
        q.order=function(){return q;};
        q.limit=function(){return q;};
        q.single=function(){return Promise.resolve({data:null,error:null});};
        q.maybeSingle=function(){return Promise.resolve({data:null,error:null});};
        q.then=function(fn){return Promise.resolve({data:[],error:null}).then(fn);};
        return q;
    }
    function vodexMockSupabaseClient(){
      return {
        auth:{
          getSession:function(){return Promise.resolve({data:{session:vodexPreviewAuthed()?{user:mockUser}:null},error:null});},
          getUser:function(){return Promise.resolve({data:{user:vodexPreviewAuthed()?mockUser:null},error:null});},
          onAuthStateChange:function(cb){try{if(cb)cb(vodexPreviewAuthed()?"SIGNED_IN":"SIGNED_OUT",vodexPreviewAuthed()?{user:mockUser}:null);}catch(e){}return {data:{subscription:{unsubscribe:function(){}}}};},
          signInWithPassword:function(){try{localStorage.setItem("sb-preview-auth","1");}catch(e){}return Promise.resolve({data:{user:mockUser,session:{user:mockUser}},error:null});},
          signInWithOAuth:function(){return vodexNavigateLogin();},
          signInWithPopup:function(){return vodexNavigateLogin();},
          signOut:function(){try{localStorage.removeItem("sb-preview-auth");localStorage.removeItem("vodex-preview-session");}catch(e){}return Promise.resolve({error:null});},
          redirectToLogin:vodexNavigateLogin,
          redirectToSignup:vodexNavigateLogin,
          login:vodexNavigateLogin,
          requireAuth:function(){if(!vodexPreviewAuthed())return vodexNavigateLogin();return Promise.resolve(mockUser);},
          me:function(){return Promise.resolve(vodexPreviewAuthed()?mockUser:null);},
          logout:function(){try{localStorage.removeItem("sb-preview-auth");}catch(e){}return Promise.resolve();}
        },
        from:function(){return vodexQueryChain();},
        storage:{from:function(){return {
          upload:function(){return Promise.resolve({data:null,error:null});},
          getPublicUrl:function(){return {data:{publicUrl:PLACEHOLDER_IMG}};},
          download:function(){return Promise.resolve({data:null,error:null});}
        };}}
      };
    }
    function vodexMockBase44Client(){
      var c=vodexMockSupabaseClient();
      c.entities=new Proxy({},{get:function(){return vodexQueryChain();}});
      c.functions={invoke:function(){return Promise.resolve({data:{},error:null});}};
      return c;
    }
    if(typeof window.createClient!=="function"){
      window.createClient=vodexMockSupabaseClient;
    }
    if(typeof window.createBase44Client!=="function"){
      window.createBase44Client=vodexMockBase44Client;
    }
    var PLACEHOLDER_IMG="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    document.addEventListener("error",function(ev){
      var t=ev.target;
      if(!t||t.tagName!=="IMG")return;
      var src=t.getAttribute("src")||"";
      if(!/supabase\\.co\\/storage/i.test(src))return;
      if(t.getAttribute("data-vodex-placeholder"))return;
      t.setAttribute("data-vodex-placeholder","1");
      t.src=PLACEHOLDER_IMG;
    },true);
    var origFetch=window.fetch;
    function jsonResponse(body){
      return Promise.resolve(new Response(JSON.stringify(body),{status:200,headers:{"Content-Type":"application/json"}}));
    }
    function pathOf(url){
      if(!url||typeof url!=="string")return"";
      try{return new URL(url,window.location.origin).pathname;}catch(e){
        var p=String(url).split("?")[0];
        return p.startsWith("/")?p:"/"+p;
      }
    }
    function mockPreviewApi(url,init){
      var path=pathOf(url);
      if(!path)return null;
      if(path==="/me"||path.endsWith("/me"))return jsonResponse({data:mockUser,user:mockUser,session:{user:mockUser}});
      if(/\\/batch(\\?|$|\\/)/i.test(path))return jsonResponse({data:[],results:[],ok:true});
      if(path==="/null"||path.endsWith("/null"))return jsonResponse({data:null,ok:true});
      if(/getRipoAssetPublic|RipoAsset|AssetPublic|ripo|lottie|animation/i.test(path)||/getRipoAssetPublic|RipoAsset|ripo|lottie/i.test(String(url))){
        var pid=window.__VODEX_PROJECT_ID__;
        if(pid){
          var q=String(url).split("?")[1]||"";
          var nameMatch=q.match(/(?:name|asset|id|key|file|path)=([^&]+)/i)||path.match(/([^/?]+)(?:\\?|$)/);
          var assetName=nameMatch?decodeURIComponent(nameMatch[1]):"";
          return origFetch("/api/projects/"+pid+"/imported-assets/lookup?name="+encodeURIComponent(assetName),{credentials:"include"})
            .then(function(r){return r.ok?r.json():{data:null};})
            .then(function(j){
              var url=j&&j.public_url||j&&j.url||(j&&j.data&&j.data.public_url);
              if(url)return jsonResponse({data:j.data||j,items:j.items||[j.data||j],ok:true,url:url,public_url:url,animation_url:url,src:url});
              return jsonResponse({data:j&&j.data?j.data:j,items:j&&j.items?j.items:[],ok:true});
            })
            .catch(function(){return jsonResponse({data:[],items:[],ok:true});});
        }
        return jsonResponse({data:[],items:[],ok:true});
      }
      if(/\\/auth\\/|\\/oauth\\/|loginWithGoogle|signInWithGoogle/i.test(path)&&(!init||!init.method||init.method==="GET"||init.method==="POST")){
        var loginUrl=previewAuthUrl();
        if(loginUrl)return jsonResponse({url:loginUrl,redirect_url:loginUrl,authorization_url:loginUrl,ok:true});
        return jsonResponse({data:mockUser,user:mockUser});
      }
      if(/\\/auth\\/|\\/login|\\/signup/i.test(path)&&(!init||!init.method||init.method==="GET"))return jsonResponse({data:mockUser,user:mockUser});
      if(/\\/entities\\/|\\/records\\/|\\/invoke/i.test(path))return jsonResponse({data:[],ok:true});
      return null;
    }
    window.fetch=function(input,init){
      var url=typeof input==="string"?input:(input&&input.url)||"";
      var mocked=mockPreviewApi(url,init);
      if(mocked)return mocked;
      if(/base44\\.dev|\\/api\\/base44|functions\\.invoke/i.test(url)){
        if(/ripo|lottie|asset|animation|getRipo/i.test(url)){
          var ripoMock=mockPreviewApi(url,init);
          if(ripoMock)return ripoMock;
        }
        if(/\\/auth\\/|\\/oauth\\/|loginWithGoogle|signInWithGoogle/i.test(url)){
          var loginUrl=previewAuthUrl();
          if(loginUrl)return jsonResponse({url:loginUrl,redirect_url:loginUrl,ok:true});
        }
        warn("Mocked Base44 API: "+url);
        return jsonResponse({data:[],ok:true,user:mockUser,session:{user:mockUser}});
      }
      if(/supabase\\.co\\/storage\\/v1\\//i.test(url)){
        if(/\\.(png|jpe?g|gif|webp|svg|ico)(\\?|$)/i.test(url)){
          var placeholder="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
          return Promise.resolve(new Response(placeholder,{status:200,headers:{"Content-Type":"image/gif"}}));
        }
        return jsonResponse({data:null,ok:true});
      }
      if(/supabase\\.co\\/auth|\\/rest\\/v1\\//i.test(url)&&init&&init.method&&init.method!=="GET"){
        warn("Blocked mutating Supabase call in preview: "+url);
        return jsonResponse({data:null});
      }
      return origFetch.apply(this,arguments);
    };
    try{
      var OrigXHR=window.XMLHttpRequest;
      function MockXHR(){
        var xhr=new OrigXHR();
        var _open=xhr.open.bind(xhr);
        var _send=xhr.send.bind(xhr);
        var _url="";
        var _method="GET";
        xhr.open=function(method,url){
          _method=method||"GET";
          _url=typeof url==="string"?url:"";
          return _open.apply(xhr,arguments);
        };
        xhr.send=function(body){
          var mocked=mockPreviewApi(_url,{method:_method,body:body});
          if(mocked){
            mocked.then(function(res){return res.text();}).then(function(text){
              Object.defineProperty(xhr,"status",{value:200});
              Object.defineProperty(xhr,"readyState",{value:4});
              Object.defineProperty(xhr,"responseText",{value:text});
              Object.defineProperty(xhr,"response",{value:text});
              if(xhr.onreadystatechange)xhr.onreadystatechange();
              xhr.dispatchEvent(new Event("load"));
            }).catch(function(){_send(body);});
            return;
          }
          return _send(body);
        };
        return xhr;
      }
      MockXHR.prototype=OrigXHR.prototype;
      window.XMLHttpRequest=MockXHR;
    }catch(e){}
    var blockExternalAuthNav=function(u){
      if(typeof u!=="string")return false;
      if(/base44\\.dev|base44\\.app|accounts\\.google\\.com|google\\.com\\/o\\/oauth|oauth\\.google|appleid\\.apple\\.com/i.test(u)){
        warn("Blocked external auth navigation: "+u);
        vodexNavigateLogin();
        return true;
      }
      return false;
    };
    try{
      var _assign=location.assign.bind(location);
      location.assign=function(u){if(blockExternalAuthNav(String(u)))return;return _assign(u);};
      var _replace=location.replace.bind(location);
      location.replace=function(u){if(blockExternalAuthNav(String(u)))return;return _replace(u);};
    }catch(e){}
  }
  try{
    var env={};
    ${[...missingEnvs]
      .filter((k) => k.startsWith("VITE_") || k.startsWith("NEXT_PUBLIC_"))
      .map((k) => {
        if (/^VITE_BASE44_APP_ID$/i.test(k)) return `env["${k}"]="vodex-preview-app";`;
        if (/^VITE_BASE44_APP_BASE_URL$/i.test(k)) return `env["${k}"]=window.location.origin;`;
        if (/^VITE_BASE44_FUNCTIONS_VERSION$/i.test(k)) return `env["${k}"]="preview";`;
        if (/^VITE_BASE44_/i.test(k)) return `env["${k}"]="vodex-preview";`;
        return `env["${k}"]="";`;
      })
      .join("")}
    if(typeof import_meta!=="undefined"){}
  }catch(e){}
})();
</script>`;

  return {
    platform,
    warnings,
    missingEnvs: [...missingEnvs].filter((k) => !k.includes("SECRET") && !k.includes("SERVICE_ROLE")),
    shimScript,
  };
}

export function injectPreviewShims(html: string, adapter: LegacyAdapterInfo): string {
  if (!adapter.shimScript) return html;
  if (html.includes("data-vodex-preview-shim")) return html;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}${adapter.shimScript}`);
  }
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body[^>]*>/i, (m) => `${m}${adapter.shimScript}`);
  }
  return adapter.shimScript + html;
}

const BASE44_HOST_RE = /https?:\/\/(?:[\w-]+\.)*base44\.(?:dev|app)[^\s"'`)>]*/gi;

/** Strip Base44 platform URLs and SDK hooks from imported source before preview build. */
export function sanitizeBase44LegacyContent(content: string): string {
  let out = content;
  out = out.replace(BASE44_HOST_RE, (match) => {
    if (/login|auth|signin|signup|register/i.test(match)) return "/login";
    return "/";
  });
  out = out.replace(
    /import\s+[^;]+from\s+['"]@base44\/sdk['"]\s*;?/g,
    "// vodex: removed @base44/sdk import\n",
  );
  const previewAuthMock =
    `{ redirectToLogin: ${PREVIEW_AUTH_NAV_FN}, getUser: async () => ({ data: { user: { id: 'preview-user', email: 'preview@vodex.dev' } } }), getSession: async () => ({ data: { session: { user: { id: 'preview-user' } } } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) }`;
  out = out.replace(
    /import\s*\(\s*['"]@base44\/sdk['"]\s*\)/g,
    `Promise.resolve({ auth: ${previewAuthMock} })`,
  );
  out = out.replace(/createBase44Client\s*\([^)]*\)/g, `({ auth: ${previewAuthMock} })`);
  out = rewriteForeignSupabaseStorageUrls(out);
  return out;
}

export function sanitizeBase44ImportFiles(files: ZipImportFile[]): {
  files: ZipImportFile[];
  modifiedPaths: string[];
} {
  const modifiedPaths: string[] = [];
  const next = files.map((f) => {
    if (!/\.(tsx?|jsx?|ts|js|html|env|json)$/i.test(f.path)) return f;
    if (!/base44|@base44|BASE44_|supabase\.co\/storage/i.test(f.content)) return f;
    const content = sanitizeBase44LegacyContent(f.content);
    if (content === f.content) return f;
    modifiedPaths.push(f.path);
    return { ...f, content, sizeBytes: Buffer.byteLength(content, "utf8") };
  });
  return { files: next, modifiedPaths };
}
