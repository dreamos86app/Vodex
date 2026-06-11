/** Preview-only auth compat — Base44 / Supabase clients missing redirectToLogin in iframe. */

import { buildPreviewAuthGuardScript } from "@/lib/preview/inject-preview-auth-guard";

export function buildPreviewAuthCompatScript(): string {
  return `(function(){
  if(window.__VODEX_AUTH_COMPAT__)return;
  window.__VODEX_AUTH_COMPAT__=true;
  var warn=function(m){try{console.warn("[Vodex preview]",m);}catch(e){}};
  var mockUser={id:"preview-user",email:"preview@vodex.dev",user_metadata:{full_name:"Preview User"}};
  function previewAuthed(){try{return localStorage.getItem("sb-preview-auth")==="1";}catch(e){return false;}}
  function previewAuthUrl(){
    try{
      var m=window.location.pathname.match(/^(\\/preview-runtime\\/[^/]+\\/[^/]+)/);
      if(m)return m[1]+"/login";
    }catch(e){}
    return null;
  }
  function navLogin(){
    warn("auth -> Vodex preview login");
    var authUrl=previewAuthUrl();
    if(authUrl){window.location.href=authUrl;return Promise.resolve({ok:true});}
    try{
      if(window.__VODEX_VIRTUAL_PATH__!==undefined){
        window.__VODEX_VIRTUAL_PATH__="/login";
        history.replaceState({__vodex:"/login"},"","/");
        window.dispatchEvent(new PopStateEvent("popstate"));
      }else{
        window.postMessage({type:"vodex:navigate",path:"/login"},"*");
      }
    }catch(e){}
    return Promise.resolve({ok:true});
  }
  function navSignup(){
    var authUrl=previewAuthUrl();
    if(authUrl){window.location.href=authUrl.replace(/\\/login$/,"/signup");return Promise.resolve({ok:true});}
    return navLogin();
  }
  function enrichAuth(auth){
    if(!auth||typeof auth!=="object")return auth;
    var names=["redirectToLogin","login","signIn","requireAuth"];
    for(var i=0;i<names.length;i++){
      if(typeof auth[names[i]]!=="function")auth[names[i]]=navLogin;
    }
    if(typeof auth.redirectToSignup!=="function")auth.redirectToSignup=navSignup;
    if(typeof auth.signUp!=="function")auth.signUp=navSignup;
    if(typeof auth.signInWithOAuth!=="function")auth.signInWithOAuth=function(){return navLogin();};
    if(typeof auth.signInWithPopup!=="function")auth.signInWithPopup=function(){return navLogin();};
    if(typeof auth.signInWithOtp!=="function")auth.signInWithOtp=function(){return Promise.resolve({data:{user:mockUser,session:{user:mockUser}},error:null});};
    if(typeof auth.me!=="function")auth.me=function(){return Promise.resolve(previewAuthed()?mockUser:null);};
    if(typeof auth.logout!=="function")auth.logout=function(){try{localStorage.removeItem("sb-preview-auth");}catch(e){}return Promise.resolve();};
    if(typeof auth.getUser!=="function")auth.getUser=function(){return Promise.resolve({data:{user:previewAuthed()?mockUser:null},error:null});};
    if(typeof auth.getSession!=="function")auth.getSession=function(){return Promise.resolve({data:{session:previewAuthed()?{user:mockUser}:null},error:null});};
    if(typeof auth.onAuthStateChange!=="function")auth.onAuthStateChange=function(cb){try{if(cb)cb(previewAuthed()?"SIGNED_IN":"SIGNED_OUT",previewAuthed()?{user:mockUser}:null);}catch(e){}return {data:{subscription:{unsubscribe:function(){}}}};};
    if(typeof auth.signOut!=="function")auth.signOut=function(){return Promise.resolve({error:null});};
  }
  window.__vodexEnrichAuth=enrichAuth;
  function wrapClient(client){
    if(!client||client.__vodexAuthWrapped)return client;
    if(client.auth)enrichAuth(client.auth);
    client.__vodexAuthWrapped=true;
    return client;
  }
  function patchCreateClient(name,factory){
    if(typeof factory!=="function")return;
    window[name]=function(){
      return wrapClient(factory.apply(this,arguments));
    };
  }
  patchCreateClient("createClient",window.createClient);
  patchCreateClient("createBase44Client",window.createBase44Client);
  try{
    var _assign=Object.assign;
    Object.assign=function(target){
      var out=_assign.apply(Object,arguments);
      for(var i=1;i<arguments.length;i++){
        var src=arguments[i];
        if(src&&src.auth)enrichAuth(src.auth);
      }
      if(target&&target.auth)enrichAuth(target.auth);
      return out;
    };
  }catch(e){}
})();`;
}

/** Prepend auth compat to served JS bundles (Vite chunks with inlined Base44 client). */
export function prependPreviewAuthCompatToJs(bundle: string): string {
  if (bundle.includes("__VODEX_AUTH_COMPAT__")) return bundle;
  return `${buildPreviewAuthGuardScript()}\n${buildPreviewAuthCompatScript()}\n${patchMinifiedAuthObjectsInJs(bundle)}`;
}

const PREVIEW_AUTH_NAV_FN =
  'async function(){try{window.__VODEX_VIRTUAL_PATH__="/login";history.replaceState({},"","/");window.dispatchEvent(new PopStateEvent("popstate"));}catch(e){}return Promise.resolve()}';

/** Patch sanitized Base44 auth literals baked into built chunks (missing redirectToLogin). */
export function patchMinifiedAuthObjectsInJs(text: string): string {
  return text.replace(
    /auth:\{(?![^}]{0,500}redirectToLogin)(getUser|getSession|onAuthStateChange)/g,
    `auth:{redirectToLogin:${PREVIEW_AUTH_NAV_FN},$1`,
  );
}

export function injectPreviewAuthCompat(html: string): string {
  if (html.includes("vodex-preview-auth-compat")) return html;
  const script = `<script id="vodex-preview-auth-compat" data-vodex-preview-shim="true">${buildPreviewAuthCompatScript()}</script>`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}${script}`);
  }
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body[^>]*>/i, (m) => `${m}${script}`);
  }
  return script + html;
}
