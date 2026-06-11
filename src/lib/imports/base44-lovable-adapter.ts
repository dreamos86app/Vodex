import type { ZipImportFile } from "@/lib/import/zip-file-validator";
import type { FrameworkDetection } from "@/lib/imports/framework-detector";

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
    try{
      if(!window.localStorage.getItem("sb-preview-auth")){
        window.localStorage.setItem("sb-preview-auth","1");
      }
    }catch(e){}
    var origFetch=window.fetch;
    window.fetch=function(input,init){
      var url=typeof input==="string"?input:(input&&input.url)||"";
      if(/base44\\.dev|\\/api\\/base44|functions\\.invoke/i.test(url)){
        warn("Mocked Base44 API: "+url);
        return Promise.resolve(new Response(JSON.stringify({data:[],ok:true,user:mockUser,session:{user:mockUser}}),{status:200,headers:{"Content-Type":"application/json"}}));
      }
      if(/supabase\\.co\\/auth|\\/rest\\/v1\\//i.test(url)&&init&&init.method&&init.method!=="GET"){
        warn("Blocked mutating Supabase call in preview: "+url);
        return Promise.resolve(new Response(JSON.stringify({data:null}),{status:200,headers:{"Content-Type":"application/json"}}));
      }
      return origFetch.apply(this,arguments);
    };
    var blockBase44Nav=function(u){
      if(typeof u!=="string")return false;
      if(/base44\\.dev|base44\\.app/i.test(u)){
        warn("Blocked Base44 navigation: "+u);
        try{
          if(window.__VODEX_VIRTUAL_PATH__!==undefined){
            window.__VODEX_VIRTUAL_PATH__="/login";
            history.replaceState({__vodex:"/login"},"","/");
            window.dispatchEvent(new PopStateEvent("popstate"));
          }else{window.postMessage({type:"vodex:navigate",path:"/login"},"*");}
        }catch(e){}
        return true;
      }
      return false;
    };
    try{
      var _assign=location.assign.bind(location);
      location.assign=function(u){if(blockBase44Nav(String(u)))return;return _assign(u);};
      var _replace=location.replace.bind(location);
      location.replace=function(u){if(blockBase44Nav(String(u)))return;return _replace(u);};
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
  out = out.replace(
    /import\s*\(\s*['"]@base44\/sdk['"]\s*\)/g,
    "Promise.resolve({ auth: { getUser: () => ({ data: { user: { id: 'preview-user' } } }) } })",
  );
  out = out.replace(/createBase44Client\s*\([^)]*\)/g, "({ auth: { getUser: async () => ({ data: { user: { id: 'preview-user', email: 'preview@vodex.dev' } } }) } })");
  return out;
}

export function sanitizeBase44ImportFiles(files: ZipImportFile[]): {
  files: ZipImportFile[];
  modifiedPaths: string[];
} {
  const modifiedPaths: string[] = [];
  const next = files.map((f) => {
    if (!/\.(tsx?|jsx?|ts|js|html|env|json)$/i.test(f.path)) return f;
    if (!/base44|@base44|BASE44_/i.test(f.content)) return f;
    const content = sanitizeBase44LegacyContent(f.content);
    if (content === f.content) return f;
    modifiedPaths.push(f.path);
    return { ...f, content, sizeBytes: Buffer.byteLength(content, "utf8") };
  });
  return { files: next, modifiedPaths };
}
